/**
 * Ring Buffer - Circular buffer for efficient data storage
 * Used for frame metrics, aggregations, and event logs
 */

export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private _size = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  /**
   * Add an item to the buffer
   */
  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this._size < this.capacity) {
      this._size++;
    }
  }

  /**
   * Get the current size
   */
  get size(): number {
    return this._size;
  }

  /**
   * Check if buffer is empty
   */
  get isEmpty(): boolean {
    return this._size === 0;
  }

  /**
   * Check if buffer is full
   */
  get isFull(): boolean {
    return this._size === this.capacity;
  }

  /**
   * Get item at index (0 = oldest, size-1 = newest)
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this._size) {
      return undefined;
    }
    const actualIndex = (this.head - this._size + index + this.capacity) % this.capacity;
    return this.buffer[actualIndex];
  }

  /**
   * Get the most recent item
   */
  getLast(): T | undefined {
    if (this._size === 0) return undefined;
    const lastIndex = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[lastIndex];
  }

  /**
   * Get the oldest item
   */
  getFirst(): T | undefined {
    if (this._size === 0) return undefined;
    return this.get(0);
  }

  /**
   * Convert buffer to array (oldest first)
   */
  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this._size; i++) {
      const item = this.get(i);
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Get the latest N items (newest first)
   */
  getLatest(n: number): T[] {
    const count = Math.min(n, this._size);
    const result: T[] = [];
    for (let i = this._size - 1; i >= this._size - count; i--) {
      const item = this.get(i);
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this._size = 0;
  }

  /**
   * Iterate over all items (oldest first)
   */
  forEach(callback: (item: T, index: number) => void): void {
    for (let i = 0; i < this._size; i++) {
      const item = this.get(i);
      if (item !== undefined) {
        callback(item, i);
      }
    }
  }

  /**
   * Map over all items
   */
  map<U>(callback: (item: T, index: number) => U): U[] {
    const result: U[] = [];
    this.forEach((item, index) => {
      result.push(callback(item, index));
    });
    return result;
  }

  /**
   * Filter items
   */
  filter(predicate: (item: T) => boolean): T[] {
    const result: T[] = [];
    this.forEach((item) => {
      if (predicate(item)) {
        result.push(item);
      }
    });
    return result;
  }

  /**
   * Reduce over all items
   */
  reduce<U>(callback: (acc: U, item: T) => U, initial: U): U {
    let acc = initial;
    this.forEach((item) => {
      acc = callback(acc, item);
    });
    return acc;
  }
}

/**
 * Calculate median of an array of numbers
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
