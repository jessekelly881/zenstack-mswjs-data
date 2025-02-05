import { Model } from "@zenstackhq/sdk/ast";
import ts, { factory } from "typescript";

const importAst = factory.createImportDeclaration(
	undefined,
	factory.createImportClause(
		false,
		undefined,
		factory.createNamedImports([
			factory.createImportSpecifier(
				false,
				undefined,
				factory.createIdentifier("factory")
			),
			factory.createImportSpecifier(
				false,
				undefined,
				factory.createIdentifier("nullable")
			),
			factory.createImportSpecifier(
				false,
				undefined,
				factory.createIdentifier("primaryKey")
			)
		])
	),
	factory.createStringLiteral("@mswjs/data"),
	undefined
)

export const databaseFileAst = (model: Model) => {
	console.log(model.imports.length);
	return [
		importAst,
		factory.createVariableStatement(
			[factory.createToken(ts.SyntaxKind.ExportKeyword)],
			factory.createVariableDeclarationList(
				[factory.createVariableDeclaration(
					factory.createIdentifier("db"),
					undefined,
					undefined,
					factory.createCallExpression(
						factory.createIdentifier("factory"),
						undefined,
						[factory.createObjectLiteralExpression(
							[factory.createPropertyAssignment(
								factory.createIdentifier("i"),
								factory.createObjectLiteralExpression(
									[factory.createPropertyAssignment(
										factory.createIdentifier("a"),
										factory.createIdentifier("Number")
									)],
									true
								)
							)],
							true
						)]
					)
				)],
				ts.NodeFlags.Const
			)
		)
	];
}


/**
 * Convert an AST to a string
 */
export const astToString = (
	nodes: ts.Node | ts.Node[],
	printerOptions?: ts.PrinterOptions,
) => {
	const sourceFile = ts.createSourceFile(
		"print.ts",
		"",
		ts.ScriptTarget.Latest,
		false,
		ts.ScriptKind.TS,
	);
	const printer = ts.createPrinter(printerOptions);

	const output = printer.printList(
		ts.ListFormat.MultiLine,
		ts.factory.createNodeArray(Array.isArray(nodes) ? nodes : [nodes]),
		sourceFile,
	);

	return output;
};
