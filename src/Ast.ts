import { BuiltinType, DataModelField, Enum, isDataModel, isEnum, Model } from "@zenstackhq/sdk/ast";
import { Match } from "effect";
import ts, { factory } from "typescript";

/** @internal */
const imports = [
	factory.createImportDeclaration(
		undefined,
		factory.createImportClause(
			false,
			undefined,
			factory.createNamedImports([
				factory.createImportSpecifier(
					false,
					undefined,
					factory.createIdentifier("nullable")
				),
				factory.createImportSpecifier(
					false,
					undefined,
					factory.createIdentifier("primaryKey")
				),
				factory.createImportSpecifier(
					false,
					undefined,
					factory.createIdentifier("identity")
				),
				factory.createImportSpecifier(
					false,
					undefined,
					factory.createIdentifier("oneOf")
				)
			])
		),
		factory.createStringLiteral("@mswjs/data"),
		undefined
	),
	factory.createImportDeclaration(
		undefined,
		factory.createImportClause(
			false,
			undefined,
			factory.createNamedImports([factory.createImportSpecifier(
				false,
				undefined,
				factory.createIdentifier("ModelDictionary")
			)])
		),
		factory.createStringLiteral("@mswjs/data/lib/glossary"),
		undefined
	),

	// import { faker } from "@faker-js/faker";
	factory.createImportDeclaration(
		undefined,
		factory.createImportClause(
			false,
			undefined,
			factory.createNamedImports([factory.createImportSpecifier(
				false,
				undefined,
				factory.createIdentifier("faker")
			)])
		),
		factory.createStringLiteral("@faker-js/faker"),
		undefined
	)
]

export const enumAst = (e: Enum) => factory.createVariableStatement(
	undefined,
	factory.createVariableDeclarationList(
		[factory.createVariableDeclaration(
			factory.createIdentifier(e.name),
			undefined,
			undefined,
			factory.createCallExpression(
				factory.createIdentifier("identity"),
				undefined,
				[factory.createCallExpression(
					factory.createPropertyAccessExpression(
						factory.createPropertyAccessExpression(
							factory.createIdentifier("faker"),
							factory.createIdentifier("helpers")
						),
						factory.createIdentifier("arrayElement")
					),
					undefined,
					[factory.createAsExpression(
						factory.createArrayLiteralExpression(
							e.fields.map(f => factory.createStringLiteral(f.name)),
							false
						),
						factory.createTypeReferenceNode(
							factory.createIdentifier("const"),
							undefined
						)
					)]
				)]
			)
		)],
		ts.NodeFlags.Const
	)
)


export const builtInTypeAst = Match.type<BuiltinType>().pipe(
	Match.when("BigInt", () => factory.createIdentifier("Number")), // hmm... :( ??????
	Match.when("Boolean", () => factory.createIdentifier("Boolean")),
	Match.when("Int", () => factory.createIdentifier("Number")),
	Match.when("Float", () => factory.createIdentifier("Number")),
	Match.when("String", () => factory.createIdentifier("String")),
	Match.when("Json", () => factory.createIdentifier("Object")),
	Match.when("DateTime", () => factory.createCallExpression(
		factory.createIdentifier("identity"),
		undefined,
		[factory.createCallExpression(
			factory.createPropertyAccessExpression(
				factory.createPropertyAccessExpression(
					factory.createIdentifier("faker"),
					factory.createIdentifier("date")
				),
				factory.createIdentifier("anytime")
			),
			undefined,
			[]
		)]
	)
	),
	Match.when("Decimal", () => factory.createIdentifier("Number")),
	Match.when("Bytes", () => factory.createIdentifier("Object")), // hmm... :( ??????
	Match.exhaustive
)

/** @internal */
const fieldAst = (field: DataModelField) => {
	let fieldAst: ts.Expression;
	const type = field.type

	if (type.type) {
		fieldAst = builtInTypeAst(type.type)
	}

	else if (field.type.reference?.ref) {
		const ref = field.type.reference.ref
		if (isEnum(ref)) { // ?? just use string here? ??
			fieldAst = factory.createIdentifier(ref.name)
		}
		if (isDataModel(ref)) {
			fieldAst = factory.createCallExpression(
				factory.createIdentifier("oneOf"),
				undefined,
				[factory.createStringLiteral(ref.name)]
			)
		}
	}

	// if its nothing else, its an object. the js way.
	fieldAst ??= factory.createIdentifier("Object");

	if (type.optional) {
		fieldAst = factory.createCallExpression(
			factory.createIdentifier("nullable"),
			undefined,
			[fieldAst]
		)
	}


	const isPrimaryKey = !!field.attributes.find(attr => attr.decl.ref?.name === "@id")
	return isPrimaryKey ? factory.createCallExpression(
		factory.createIdentifier("primaryKey"),
		undefined,
		[fieldAst]
	) : fieldAst;

};

export const databaseFileAst = (model: Model) => {
	const dataModels = model.declarations.filter(isDataModel);
	const enums = model.declarations.filter(isEnum);

	const dictObjAst = factory.createObjectLiteralExpression(
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
	)


	return [
		...imports,
		...enums.map(enumAst),
		factory.createVariableStatement(
			undefined,
			factory.createVariableDeclarationList(
				[factory.createVariableDeclaration(
					factory.createIdentifier("dictionary"),
					undefined,
					undefined,
					factory.createSatisfiesExpression(
						dictObjAst,
						factory.createTypeReferenceNode(
							factory.createIdentifier("ModelDictionary"),
							undefined
						)
					)
				)],
				ts.NodeFlags.Const
			)
		),
		factory.createExportAssignment(
			undefined,
			undefined,
			factory.createIdentifier("dictionary")
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
