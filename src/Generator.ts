import { FileSystem, Path } from "@effect/platform";
import { PlatformError } from "@effect/platform/Error";
import { Model } from "@zenstackhq/sdk/ast";
import { Duration, Effect, Layer } from "effect";
import * as Ast from "./Ast";

export class Generator extends Effect.Tag("Generator")<Generator, {
	readonly run: (model: Model, outputFolder: string) => Effect.Effect<void, PlatformError>
}>() { }

export const layer = Layer.effect(Generator, Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path

	const runCodegen = (model: Model, outputDirectory: string) => Effect.gen(function* () {
		yield* fs.makeDirectory(outputDirectory, { recursive: true });

		yield* fs.writeFileString(
			path.join(outputDirectory, "index.ts"),
			Ast.astToString(Ast.databaseFileAst(model))
		);
	})

	/**
	 * Creates a temporary directory and runs the codegen in that directory. 
	 * Then swaps in the temporary directory to the output folder and removes the temporary directory.
	 * Ensures that the output folder is written to atomically. If codegen fails nothing is written to the output dir.
	 */
	const run = (model: Model, outputDirectoryPath: string) => Effect.gen(function* () {
		const tempDir = yield* fs.makeTempDirectoryScoped()
		yield* runCodegen(model, tempDir);

		yield* fs.copy(tempDir, outputDirectoryPath, { overwrite: true, preserveTimestamps: true })
	}).pipe(
		Effect.scoped,
		Effect.timed,
		Effect.tap(([duration]) => Effect.logInfo(`Completed mswjs-data codegen in: ${Duration.format(duration)}`))
	)

	return {
		run
	}
}))
