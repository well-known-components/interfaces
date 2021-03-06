/**
 * @public
 */
export interface IConfigComponent {
  getString(name: string): Promise<string | undefined>
  getNumber(name: string): Promise<number | undefined>
  requireString(name: string): Promise<string>
  requireNumber(name: string): Promise<number>
}
