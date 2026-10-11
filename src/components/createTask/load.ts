import type { CreateTaskOptions } from './createTask';

export default function createTask(options?: CreateTaskOptions) {
  return import('./createTask').then(({ default: createTask }) => createTask(options));
}
