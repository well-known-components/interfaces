/**
 * @public
 */
export namespace IMetricsComponent {
  export type GaugeType = "gauge"
  export type CounterType = "counter"
  export type HistogramType = "histogram"
  export type SummaryType = "summary"
  export const GaugeType: GaugeType = "gauge"
  export const CounterType: CounterType = "counter"
  export const HistogramType: HistogramType = "histogram"
  export const SummaryType: SummaryType = "summary"

  export type GaugeMetricDefinition = {
    type: GaugeType
    help: string
    labelNames?: string[] | readonly string[]
  }

  export type CounterMetricDefinition = {
    type: CounterType
    help: string
    labelNames?: string[] | readonly string[]
  }

  export type HistogramMetricDefinition = {
    type: HistogramType
    help: string
    labelNames?: string[] | readonly string[]

    buckets?: number[]
  }

  export type SummaryMetricDefinition = {
    type: SummaryType
    help: string
    labelNames?: string[] | readonly string[]

    percentiles?: number[]
    maxAgeSeconds?: number
    ageBuckets?: number
    compressCount?: number
  }

  export type MetricDefinition =
    | GaugeMetricDefinition
    | CounterMetricDefinition
    | HistogramMetricDefinition
    | SummaryMetricDefinition

  export type ExportedMetricData = {
    help: string
    name: string
    type: MetricDefinition["type"]
    values: any[]
    aggregator: string
  }

  export type MetricsRecordDefinition<K extends string> = Record<K, MetricDefinition>
  export type Labels = Record<string, string | number>

  export type Registry = {
    contentType: string
    metrics(): Promise<string>
  }
}

/**
 * @public
 */
export interface IMetricsComponent<K extends string> {
  /**
   * Optional registry component, this will be used to expose the metrics for pulling
   * (for example, for prometheus)
   */
  registry?: IMetricsComponent.Registry
  /**
   * startTimer returns an object with an "end" function that must be
   * called at the end of the measurement.
   *
   * Labels are merged at the end.
   *
   * Works with: Gauge, Histogram, Summary
   */
  startTimer(metricName: K, labels?: IMetricsComponent.Labels): { end: (endLabels?: IMetricsComponent.Labels) => void }
  /**
   * Observes a single value.
   *
   * Works with: Gauge, Summary, Histogram
   */
  observe(metricName: K, labels: IMetricsComponent.Labels, value: number): void
  /**
   * Increments the metric by (value default=1) units.
   *
   * Works with: Counter, Gauge
   */
  increment(metricName: K, labels?: IMetricsComponent.Labels, value?: number): void
  /**
   * Decrements the metric by (value default=1) units.
   *
   * Works with: Gauge
   */
  decrement(metricName: K, labels?: IMetricsComponent.Labels, value?: number): void
  /**
   * Resets the metric.
   */
  reset(metricName: K): void
  /**
   * Resets all metrics.
   */
  resetAll(): void
  /**
   * Gets the current value of a metric
   */
  getValue(metricName: K): Promise<IMetricsComponent.ExportedMetricData>
}
