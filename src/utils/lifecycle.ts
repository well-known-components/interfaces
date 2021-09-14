import { IBaseComponent } from "../components/base-component"

function stopAllComponents(components: Record<string, IBaseComponent>) {
  const pending: PromiseLike<any>[] = []
  for (let c in components) {
    const component = components[c]
    if (component.stop && typeof component.stop == "function") {
      pending.push(component.stop())
    }
  }
  return Promise.all(pending)
}

// gracefully finalizes all the components on SIGTERM
function bindStopService(components: Record<string, IBaseComponent>) {
  process.on("SIGTERM", () => {
    process.stdout.write("<<< SIGTERM received >>>\n")
    stopAllComponents(components)
      .then(() => process.exit())
      .catch((e) => {
        process.stderr.write(e + '\n')
        console.error(e)
        process.exit(1)
      })
  })
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
  process.stdout.write("<<< Starting components >>>\n")
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
      process.stderr.write(
        "<<< Error initializing components. Component '" + c + "' is a Promise, it should be an object, did you miss an await in the initComponents?. >>>\n"
      )
    }
    if (component.start && typeof component.start == "function") {
      const awaitable = component.start(immutableStartOptions)
      if (awaitable && typeof awaitable == "object" && "then" in awaitable) {
        pending.push(awaitable)
        if (awaitable.catch) {
          // avoid unhanled catch error messages in node.
          // real catch happens below in `Promise.all(pending)`
          awaitable.catch(() => void 0)
        }
      }
    }
  }

  // application started
  mutLive = true

  bindStopService(components)

  if (pending.length == 0) return

  try {
    await Promise.all(pending)
    mutStarted = true
  } catch (e) {
    process.stderr.write("<<< Error initializing components. Stopping components and closing application. >>>\n")
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
    startComponents(): Promise<void>
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
   *
   * @deprecated Lifecycle.programEntryPoint is deprecated, please use Lifecycle.run()
   */
  export async function programEntryPoint<Components extends Record<string, any>>(config: {
    main: (components: Components) => Promise<any>
    initComponents: () => Promise<Components>
  }): Promise<ComponentBasedProgram<Components>> {
    return run({
      ...config,
      async main(program) {
        const r = await config.main(program.components)
        await program.startComponents()
        return r
      },
    })
  }

  /**
   * Program entry point, this should be the one and only top level
   * expression of your program.
   */
  export function run<Components extends Record<string, any>>(
    config: ProgramConfig<Components>
  ): PromiseLike<ComponentBasedProgram<Components>> {
    return asyncTopLevelExceptionHanler(async () => {
      // pick a componentInitializer
      const componentInitializer = config.initComponents

      // init ports & components
      process.stdout.write("<<< Initializing components >>>\n")
      const components: Components = Object.freeze(await componentInitializer())

      let componentsStarted: Promise<void> | undefined

      const program: EntryPointParameters<Components> = {
        get components() {
          return components
        },
        async stop(): Promise<void> {
          await stopAllComponents(components)
        },
        async startComponents() {
          if (!componentsStarted) {
            // start components & ports
            componentsStarted = startComponentsLifecycle(components)
          } else {
            process.stderr.write("Warning: startComponents must be called once\n")
          }

          return componentsStarted
        },
      }

      try {
        // wire adapters
        process.stdout.write("<<< Wiring app >>>\n")
        await config.main(program)

        if (!componentsStarted) {
          process.stderr.write("Warning: startComponents was not called inside programEntryPoint.main function\n")
        } else {
          await componentsStarted
        }
      } catch (e) {
        // gracefully stop all components
        await program.stop()

        // the following throw is handled by asyncTopLevelExceptionHanler
        // exiting the program
        throw e
      }

      return program
    })
  }
}
