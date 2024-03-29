import * as fetch from "node-fetch"

/**
 * @public
 */
export type RequestOptions = fetch.RequestInit & {
  abortController?: AbortController
  timeout?: number
  attempts?: number
  retryDelay?: number
}

/**
 * @alpha
 */
export type Response = fetch.Response

/**
 * @alpha
 */
export type Request = fetch.Request | fetch.RequestInfo

/**
 * @public
 */
export type IFetchComponent = {
  fetch(url: Request): Promise<Response>
  fetch(url: Request, init?: RequestOptions): Promise<Response>
}
