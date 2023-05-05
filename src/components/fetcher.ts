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
 * @public
 */
export type IFetchComponent = {
  fetch(url: fetch.Request): Promise<fetch.Response>
  fetch(url: fetch.RequestInfo, init?: RequestOptions): Promise<fetch.Response>
}
