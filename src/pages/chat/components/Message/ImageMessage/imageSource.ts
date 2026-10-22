/** Finite view of the native src setter input; the host performs its own conversion/failure. */
export interface ImageSourceSink { src: unknown; }
export function setImageSource(image: ImageSourceSink, source: unknown): void {
  image.src = source;
}
