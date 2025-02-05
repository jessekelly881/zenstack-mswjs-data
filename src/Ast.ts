import { BuiltinType, DataModelField, isDataModel, Model } from "@zenstackhq/sdk/ast";
import { Match } from "effect";
import ts, { factory } from "typescript";

/** @internal */
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

export const builtInTypeAst = Match.type<BuiltinType>().pipe(
	Match.when("BigInt", () => factory.createIdentifier("Number")), // hmm... :( ??????
	Match.when("Boolean", () => factory.createIdentifier("Boolean")),
	Match.when("Int", () => factory.createIdentifier("Number")),
	Match.when("Float", () => factory.createIdentifier("Number")),
	Match.when("String", () => factory.createIdentifier("String")),
	Match.when("Json", () => factory.createIdentifier("Object")),
	Match.when("DateTime", () => factory.createIdentifier("Date")),
	Match.when("Decimal", () => factory.createIdentifier("Number")),
	Match.when("Bytes", () => factory.createIdentifier("String")), // hmm... :( ??????
	Match.exhaustive
)

/** @internal */
const fieldAst = (field: DataModelField) => {
	const { type } = field.type
	if (type) {
		return builtInTypeAst(type)
	}

	else return factory.createIdentifier("Object")

};

export const databaseFileAst = (model: Model) => {
	console.log(model.imports.length);
	const dataModels = model.declarations.filter(isDataModel);

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
							dataModels.map(dm => factory.createPropertyAssignment(
								factory.createIdentifier(dm.name),
								factory.createObjectLiteralExpression(
									dm.fields.map(field =>
										factory.createPropertyAssignment(
											factory.createIdentifier(field.name),
											fieldAst(field)
										)),
									true
								)
							)),
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
