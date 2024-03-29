import type * as stream from "stream"
import type * as fetch from "node-fetch"
import type { IMiddlewareAdapterHandler } from "./base-component"
import type { ParseUrlParams as _ParseUrlParams } from "typed-url-params"

/**
 * @alpha
 */
export namespace IHttpServerComponent {
  // only objects for the time being. Rationale: https://menduz.com/posts/2019.05.07
  export type JsonBody = Record<string, any>
  export type ResponseBody = JsonBody | stream.Readable | Uint8Array | Buffer | string

  export type QueryParams = Record<string, any>
  export type UrlParams = Record<string, string | string[]>
  export type IRequest = fetch.Request
  export type IResponse = fetch.ResponseInit & { body?: ResponseBody /* attachments: [] */ }

  export type DefaultContext<Context = {}> = Context & {
    request: IRequest
    url: URL
  }
  export type PathAwareContext<Context = {}, Path extends string = string> = Context & {
    params: string extends Path ? any : IHttpServerComponent.ParseUrlParams<Path>
  }
  export type IRequestHandler<Context = {}> = IMiddlewareAdapterHandler<DefaultContext<Context>, IResponse>
  export type ParseUrlParams<State extends string, Memo extends Record<string, any> = {}> = _ParseUrlParams<State, Memo>

  /**
   * HTTP request methods.
   *
   * HTTP defines a set of request methods to indicate the desired action to be
   * performed for a given resource. Although they can also be nouns, these
   * request methods are sometimes referred as HTTP verbs. Each of them implements
   * a different semantic, but some common features are shared by a group of them:
   * e.g. a request method can be safe, idempotent, or cacheable.
   *
   * @public
   */
  export type HTTPMethod =
    /**
     * The `CONNECT` method establishes a tunnel to the server identified by the
     * target resource.
     */
    | "CONNECT"

    /**
     * The `DELETE` method deletes the specified resource.
     */
    | "DELETE"

    /**
     * The `GET` method requests a representation of the specified resource.
     * Requests using GET should only retrieve data.
     */
    | "GET"

    /**
     * The `HEAD` method asks for a response identical to that of a GET request,
     * but without the response body.
     */
    | "HEAD"

    /**
     * The `OPTIONS` method is used to describe the communication options for the
     * target resource.
     */
    | "OPTIONS"

    /**
     * The PATCH method is used to apply partial modifications to a resource.
     */
    | "PATCH"

    /**
     * The `POST` method is used to submit an entity to the specified resource,
     * often causing a change in state or side effects on the server.
     */
    | "POST"

    /**
     * The `PUT` method replaces all current representations of the target
     * resource with the request payload.
     */
    | "PUT"

    /**
     * The `TRACE` method performs a message loop-back test along the path to the
     * target resource.
     */
    | "TRACE"

  export interface PathAwareHandler<Context> {
    <Path extends string>(
      /**
       * /path/to/:bind
       */
      path: Path,
      /**
       * adapter code to handle the request
       */
      handler: IHttpServerComponent.IRequestHandler<PathAwareContext<Context, Path>>
    ): void
  }

  export type MethodHandlers<Context> = {
    [key in Lowercase<HTTPMethod>]: PathAwareHandler<Context>
  }
}

/**
 * @alpha
 */
export interface IHttpServerComponent<Context extends object> {
  /**
   * Register a route
   */
  use: (
    /**
     * adapter code to handle the request
     */
    handler: IHttpServerComponent.IRequestHandler<Context>
  ) => void

  /**
   * Sets a context to be passed on to the handlers.
   *
   * The original context should remain untouched after handler execution.
   */
  setContext(ctx: Context): void
}
