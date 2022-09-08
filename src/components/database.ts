/**
 * @public
 */
export namespace IDatabase {
  export interface IQueryResult<T extends Record<string, any>> {
    rows: T[]
    rowCount: number
  }
}

/**
 * Basic database interface.
 * @public
 */
export interface IDatabase {
  query<T extends Record<string, any>>(sql: string): Promise<IDatabase.IQueryResult<T>>
}
