/** Thrown for a file that cannot be imported. The message is shown to the user. */
export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}
