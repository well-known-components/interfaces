import { IBaseComponent, STOP_COMPONENT, START_COMPONENT } from "../components/base-component"

const DEBUG = !!process.env.DEBUG

function log(level: 'DEBUG' | 'WARN' | 'INFO' | 'ERROR', message: string) {
  if (level == 'DEBUG' && !DEBUG) return
  process.stderr.write(new Date().toISOString() + " [" + level + "] (well-known-components/interfaces): " + message + "\n")
}

async function stopAllComponents(components: Record<string, IBaseComponent>) {
  const reverseKeys = Object.keys(components).reverse()
  for (let c of reverseKeys) {
    const component = components[c]
    if (!component) throw new Error("Component is null: " + c)
    if (typeof component[STOP_COMPONENT] == "function") {
      log('INFO', `Stopping component ${c}`)
      await component[STOP_COMPONENT]()
    }
    // TODO: remove for 3.0.0
    else if (typeof component.stop == "function") {
      log('INFO', `Stopping component ${c}`)
      log('WARN', "IBaseComponent.stop is deprecated (in " + c + ".stop). Use IBaseComponent[STOP_COMPONENT] instead")
      await component.stop()
    }
  }
}

async function allSettled(promises: Array<Promise<any> | PromiseLike<any>>) {
  let mappedPromises = promises.map((p) => {
    let r = p.then((value: any) => {
      return {
        status: "fulfilled",
        value,
      }
    })

    if ("catch" in p) {
      r = p.catch((reason) => {
        return {
          status: "rejected",
          reason,
        }
      })
    }

    return r
  })
  return Promise.all(mappedPromises)
}

// gracefully finalizes all the components on SIGTERM
async function startComponentsLifecycle(components: Record<string, IBaseComponent>): Promise<void> {
  log('INFO', "Starting components")
  const pending: PromiseLike<any>[] = []

  let mutStarted = false
  let mutLive = false

  const immutableStartOptions: IBaseComponent.ComponentStartOptions = {
    started() {
      return mutStarted
    },
    live() {
      return mutLive
    },
    getComponents() {
      return components
    },
  }

  for (let c in components) {
    const component = components[c]
    if ((await components[c]) !== components[c]) {
      log('ERROR',
        "Error initializing components. Component '" +
        c +
        "' is a Promise, it should be an object, did you miss an await in the initComponents?."
      )
    }
    if (!component) throw new Error("Null or empty components are not allowed: " + c)
    var startFn: IBaseComponent[typeof START_COMPONENT] = undefined

    if (typeof component[START_COMPONENT] == "function") {
      startFn = component[START_COMPONENT].bind(component)
    }
    //TODO remove in 3.0
    else if (component.start && typeof component.start == "function") {
      log("WARN", c + ".start is deprecated (in " + c + ".stop). use IBaseComponent[START_COMPONENT] instead")
      startFn = component.start.bind(component)
    }

    if (startFn) {
      log('DEBUG', `Starting component ${c}`)
      const awaitable = startFn(immutableStartOptions)
      if (awaitable && typeof awaitable == "object" && "then" in awaitable) {
        pending.push(awaitable)
        await awaitable
        if (awaitable.catch) {
          // avoid unhanled catch error messages in node.
          // real catch happens below in `Promise.all(pending)`
          awaitable.catch((err) => {
            log('ERROR',
              `Error initializing component: ${JSON.stringify(
                c,
              )}. Error will appear in the next line\n${err}\n`,
            )
          })
        }
      }
    }
  }

  // application started
  mutLive = true

  if (pending.length == 0) return

  try {
    await Promise.all(pending)
    mutStarted = true
  } catch (e) {
    log("ERROR", "Error initializing components. Stopping components and closing application.")
    await allSettled(pending)
    throw e
  }
}

/**
 * handles an async function, if it fails the program exits with exit code 1
 */
function asyncTopLevelExceptionHanler<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((error) => {
    // print error and stacktrace
    console.error(error)
    // exit program with error
    process.exit(1)
  })
}

/**
 * This namespace handles the basic lifecycle of the components.
 * @public
 */
export namespace Lifecycle {
  export type ComponentBasedProgram<Components> = {
    /**
     * async stop() finishes all the components of the service and awaits for completion
     * it should be called to gracefully stop the program.
     *
     * It is automatically called on SIGTERM
     */
    stop(): Promise<void>

    /**
     * The components are present here only for debugging reasons. Do not use
     * it as part of your program.
     */
    readonly components: Components
  }

  export type EntryPointParameters<Components> = ComponentBasedProgram<Components> & {
    /**
     * The program must wire all components together and then call startComponents
     * before exiting the main() function. Otherwise it will raise an error.
     */
    startComponents(): Promise<void>
    /**
     * The program can register handlers to be run before stopping all components
     */
    beforeStopComponents(callback: () => Promise<void>): void
  }

  /**
   * Program lifecycle configurations
   */
  export type ProgramConfig<Components> = {
    /**
     * async main(program)\{ .. \} entry point of the application.
     * It should wire components together i.e. wiring routes to http-servers
     * and listeners to kafka.
     *
     * The main function must also call the program.
     *
     * Example:
     * ```ts
     * async main(program) {
     *   const { components, startComponents } = program
     *   components.server.use(routeHandler)
     *
     *   // start all components, including http listener
     *   await startComponents()
     * }
     * ```
     */
    main: (program: EntryPointParameters<Components>) => Promise<any>

    /**
     * initComponents is a function that returns the components to be used by
     * the app.
     */
    initComponents: () => Promise<Components>
  }

  /**
   * Program entry point, this should be the one and only top level
   * expression of your program.
   */
  export function run<Components extends Record<string, any>>(
    config: ProgramConfig<Components>,
  ): PromiseLike<ComponentBasedProgram<Components>> {
    return asyncTopLevelExceptionHanler(async () => {
      // pick a componentInitializer
      const componentInitializer = config.initComponents

      // init ports & components
      log("INFO", "Initializing components")
      const components: Components = Object.freeze(await componentInitializer())

      let componentsStarted: Promise<void> | undefined

      // the program can register some handlers to be run before stopping all components
      const beforeStopComponentHandlers: Array<() => Promise<void>> = []
      const beforeStopComponents = async () => {
        while (beforeStopComponentHandlers.length) {
          try {
            await (beforeStopComponentHandlers.shift()!)()
          } catch (e: any) {
            log('ERROR', e)
            console.error(e)
          }
        }
      }

      async function stopProgram() {
        process.off("SIGTERM", termHandler)
        process.off("SIGINT", termHandler)
        await beforeStopComponents()
        await stopAllComponents(components)
      }

      function termHandler() {
        log('INFO', "termination signal received")
        stopProgram()
          .then(() => process.exit())
          .catch((e) => {
            log('ERROR', e)
            console.error(e)
            process.exit(1)
          })
      }

      const program: EntryPointParameters<Components> = {
        get components() {
          return components
        },
        beforeStopComponents(callback) {
          beforeStopComponentHandlers.push(callback)
        },
        async stop(): Promise<void> {
          await stopProgram()
        },
        async startComponents() {
          if (!componentsStarted) {
            // start components
            componentsStarted = startComponentsLifecycle(components)
          } else {
            log('WARN', "Warning: startComponents must be called once\n")
          }

          return componentsStarted
        },
      }

      try {
        // wire adapters
        log('INFO', "Wiring app")
        await config.main(program)

        if (!componentsStarted) {
          log('WARN', "Warning: startComponents was not called inside programEntryPoint.main function\n")
        } else {
          await componentsStarted
        }

        // gracefully finalizes all the components on SIGINT&SIGTERM
        process.on("SIGTERM", termHandler)
        process.on("SIGINT", termHandler)
      } catch (e) {
        try {
          // gracefully stop all components
          await program.stop()
        } catch (err: any) {
          console.error(err)
        } finally {
          // the following throw is handled by asyncTopLevelExceptionHanler
          // exiting the program
          throw e
        }
      }

      return program
    })
  }
}
