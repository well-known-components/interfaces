import * as fetch from "node-fetch"

/**
 * @alpha
 */
export type IFetchComponent = {
  fetch(url: fetch.Request): Promise<fetch.Response>
  fetch(url: fetch.RequestInfo, init?: fetch.RequestInit): Promise<fetch.Response>
}