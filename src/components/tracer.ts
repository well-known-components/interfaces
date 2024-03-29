/**
 * @public
 */
export type ITracerComponent = {
  /**
   * Create a new tracing span over a specified function.
   * @param name - The name of the tracing span.
   * @param tracedFunction - The function to be traced.
   * @param traceContext - The initial trace context to initialize the new context with. Usually used to set the information about the trace parent.
   * @returns The result of the execution of the tracedFunction.
   */
  span<T>(name: string, tracedFunction: () => T, traceContext?: Omit<TraceContext, "id" | "data" | "name">): T
  /**
   * Gets if the execution context is inside of a trace span or not.
   * @returns true if it is inside of a trace span, false otherwise.
   */
  isInsideOfTraceSpan(): boolean
  /**
   * Gets the current span id.
   * @returns The current span id if the function is executed inside of a trace span.
   * @throws NotInSpanError if executed outside of a scope.
   */
  getSpanId(): string
  /**
   * Gets the information of the current trace.
   * @returns The current trace if the function is executed inside of a trace span.
   * @throws NotInSpanError if executed outside of a scope.
   */
  getTrace(): Trace
  /**
   * Gets the string representation of the information of the current trace.
   * The value is crafted using the traceparent header format.
   * @returns The string representation of the current trace.
   * @throws NotInSpanError if executed outside of a scope.
   */
  getTraceString(): string
  /**
   * Gets the information of the trace to be propagated where the parent id is the current trace span id.
   * @returns The trace child of the current trace.
   * @throws NotInSpanError if executed outside of a scope.
   */
  getTraceChild(): Trace
  /**
   * Gets the string representation of the trace to be propagated where the parent id is the current trace span id.
   * The value is crafted using the traceparent header format.
   * @returns The string representation of the trace child of the current trace.
   * @throws NotInSpanError if executed outside of a scope.
   */
  getTraceChildString(): string
  /**
   * Gets the properties of the trace state.
   * @returns The current trace state.
   * @throws NotInSpanError if executed outside of a scope.
   */
  getTraceState(): Readonly<TraceState | null>
  /**
   * Gets the string representation of the the properties of the trace state.
   * The value is crafted using the tracestate header format.
   * @returns The current trace state or null if there's no trace state.
   * @throws NotInSpanError if executed outside of a scope.
   */
  getTraceStateString(): string | undefined
  /**
   * Gets the current trace context data.
   * @returns The current trace context data.
   * @throws NotInSpanError if executed outside of a scope.
   */
  getContextData<T>(): Readonly<T | null>
  /**
   * Sets the trace context data if executed inside a trace span.
   * @param key - The key of the property to be set.
   * @param value - The value of the property to be set.
   * @throws NotInSpanError if executed outside of a scope.
   */
  setContextData<T = any>(data: T): void
  /**
   * Sets a property of the trace state if executed inside a trace span.
   * @param key - The key of the property to be set.
   * @param value - The value of the property to be set.
   * @throws NotInSpanError if executed outside of a scope.
   */
  setTraceStateProperty(key: string, value: string): void
  /**
   * Deletes a property of the trace state if executed inside a trace span.
   * @param key - The key of the property to be deleted.
   * @throws NotInSpanError if executed outside of a scope.
   */
  deleteTraceStateProperty(key: string): void
}

/**
 * @public
 */
export type TraceContext<T = any> = {
  /** The span id, used to identify the current traced code. */
  id: string
  /** The span name. */
  name: string
  /**
   * The version of the trace parent specification (version) is 1 byte representing an 8-bit unsigned integer.
   * Version ff is invalid. The current specification assumes the version is set to 00.
   */
  version: number
  /**
   * The ID of the whole trace forest and is used to uniquely identify a distributed trace through a system.
   * It is represented as a 16-byte array, for example, 4bf92f3577b34da6a3ce929d0e0e4736.
   */
  traceId: string
  /** The ID of this request as known by the caller or the span-id, where a span is the execution of a client request.
   * It is represented as an 8-byte array, for example, 00f067aa0ba902b7.
   * All bytes as zero (0000000000000000) is considered an invalid value.
   */
  parentId: string
  /** An 8-bit field that controls tracing flags such as sampling, trace level, etc. */
  traceFlags: number
  /** Provides additional vendor-specific trace identification information across different distributed tracing systems in form of a key-value pair. */
  traceState?: Record<string, string>
  /** Additional customized data for the trace. */
  data: T
}

/**
 * @public
 */
export type Trace = Pick<TraceContext, "traceId" | "version" | "parentId" | "traceFlags">

/**
 * @public
 */
export type TraceState = Required<Pick<TraceContext, "traceState">>["traceState"]
