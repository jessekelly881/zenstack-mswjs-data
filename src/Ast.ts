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
				factory.createImportSpecifier(false, undefined, factory.createIdentifier("nullable")),
				factory.createImportSpecifier(false, undefined, factory.createIdentifier("primaryKey")),
				factory.createImportSpecifier(false, undefined, factory.createIdentifier("manyOf")),
				factory.createImportSpecifier(false, undefined, factory.createIdentifier("oneOf")),
			])
		),
		factory.createStringLiteral("@mswjs/data"),
		undefined
	),
	factory.createImportDeclaration(
		undefined,
		factory.createImportClause(
			true,
			undefined,
			factory.createNamedImports([
				factory.createImportSpecifier(false, undefined, factory.createIdentifier("ModelDictionary")),
			])
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
			factory.createNamedImports([factory.createImportSpecifier(false, undefined, factory.createIdentifier("faker"))])
		),
		factory.createStringLiteral("@faker-js/faker"),
		undefined
	),
];

export const enumAst = (e: Enum) =>
	factory.createVariableStatement(
		undefined,
		factory.createVariableDeclarationList(
			[
				factory.createVariableDeclaration(
					factory.createIdentifier(e.name),
					undefined,
					undefined,
					factory.createArrowFunction(
						undefined,
						undefined,
						[],
						undefined,
						factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
						factory.createCallExpression(
							factory.createPropertyAccessExpression(
								factory.createPropertyAccessExpression(
									factory.createIdentifier("faker"),
									factory.createIdentifier("helpers")
								),
								factory.createIdentifier("arrayElement")
							),
							undefined,
							[
								factory.createAsExpression(
									factory.createArrayLiteralExpression(
										e.fields.map((f) => factory.createStringLiteral(f.name)),
										false
									),
									factory.createTypeReferenceNode(factory.createIdentifier("const"), undefined)
								),
							]
						)
					)
				),
			],
			ts.NodeFlags.Const
		)
	);

// faker.date.anytime()
const fakerDateAst = factory.createCallExpression(
	factory.createPropertyAccessExpression(
		factory.createPropertyAccessExpression(factory.createIdentifier("faker"), factory.createIdentifier("date")),
		factory.createIdentifier("anytime")
	),
	undefined,
	[]
);

// faker.date.float()
const fakerFloatAst = factory.createCallExpression(
	factory.createPropertyAccessExpression(
		factory.createPropertyAccessExpression(factory.createIdentifier("faker"), factory.createIdentifier("number")),
		factory.createIdentifier("float")
	),
	undefined,
	[]
);

const fakerBigIntAst = factory.createCallExpression(
	factory.createPropertyAccessExpression(
		factory.createPropertyAccessExpression(factory.createIdentifier("faker"), factory.createIdentifier("number")),
		factory.createIdentifier("bigInt")
	),
	undefined,
	[]
);

const fakerBooleanAst = factory.createCallExpression(
	factory.createPropertyAccessExpression(
		factory.createPropertyAccessExpression(factory.createIdentifier("faker"), factory.createIdentifier("datatype")),
		factory.createIdentifier("boolean")
	),
	undefined,
	[]
);

const fakerStringAst = factory.createCallExpression(
	factory.createPropertyAccessExpression(
		factory.createPropertyAccessExpression(factory.createIdentifier("faker"), factory.createIdentifier("lorem")),
		factory.createIdentifier("sentence")
	),
	undefined,
	[]
);

const fakerIntAst = factory.createCallExpression(
	factory.createPropertyAccessExpression(
		factory.createPropertyAccessExpression(factory.createIdentifier("faker"), factory.createIdentifier("number")),
		factory.createIdentifier("int")
	),
	undefined,
	[factory.createNumericLiteral(10)]
);

export const builtInTypeAst = Match.type<BuiltinType>().pipe(
	Match.when("BigInt", () => fakerBigIntAst),
	Match.when("Boolean", () => fakerBooleanAst),
	Match.when("Int", () => fakerIntAst),
	Match.when("Float", () => fakerFloatAst),
	Match.when("String", () => fakerStringAst),
	Match.when("Json", () => fakerStringAst), // hmm... :( ??????
	Match.when("DateTime", () => fakerDateAst),
	Match.when("Decimal", () => fakerFloatAst),
	Match.when("Bytes", () => fakerStringAst), // hmm... :( ??????
	Match.exhaustive
);

/** @internal */
const fieldAst = (field: DataModelField) => {
	let fieldAst: ts.Expression | undefined;
	const type = field.type;

	if (type.type) {
		fieldAst = factory.createArrowFunction(
			undefined,
			undefined,
			[],
			undefined,
			factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
			type.array
				? factory.createCallExpression(
						factory.createPropertyAccessExpression(factory.createIdentifier("Array"), factory.createIdentifier("from")),
						undefined,
						[
							factory.createObjectLiteralExpression(
								[
									factory.createPropertyAssignment(
										factory.createIdentifier("length"),
										factory.createCallExpression(
											factory.createPropertyAccessExpression(
												factory.createPropertyAccessExpression(
													factory.createIdentifier("faker"),
													factory.createIdentifier("number")
												),
												factory.createIdentifier("int")
											),
											undefined,
											[factory.createNumericLiteral(10)]
										)
									),
								],
								false
							),
							factory.createArrowFunction(
								undefined,
								undefined,
								[],
								undefined,
								factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
								builtInTypeAst(type.type)
							),
						]
				  )
				: builtInTypeAst(type.type)
		);
	} else if (field.type.reference?.ref) {
		const ref = field.type.reference.ref;
		if (isEnum(ref)) {
			// ?? just use string here? ??
			fieldAst = factory.createIdentifier(ref.name);
		}
		if (isDataModel(ref)) {
			fieldAst = type.array
				? factory.createCallExpression(factory.createIdentifier("manyOf"), undefined, [
						factory.createStringLiteral(ref.name),
				  ])
				: factory.createCallExpression(factory.createIdentifier("oneOf"), undefined, [
						factory.createStringLiteral(ref.name),
				  ]);
		}
	}

	// ??
	if (!fieldAst) {
		throw "Field could not assigned";
	}

	if (type.optional) {
		fieldAst = factory.createCallExpression(factory.createIdentifier("nullable"), undefined, [fieldAst]);
	}

	const isPrimaryKey = !!field.attributes.find((attr) => attr.decl.ref?.name === "@id");
	return isPrimaryKey
		? factory.createCallExpression(factory.createIdentifier("primaryKey"), undefined, [fieldAst])
		: fieldAst;
};

export const databaseFileAst = (model: Model) => {
	const dataModels = model.declarations.filter(isDataModel);
	const enums = model.declarations.filter(isEnum);

	const dictObjAst = factory.createObjectLiteralExpression(
		dataModels.map((dm) =>
			factory.createPropertyAssignment(
				factory.createIdentifier(dm.name),
				factory.createObjectLiteralExpression(
					dm.fields.map((field) =>
						factory.createPropertyAssignment(factory.createIdentifier(field.name), fieldAst(field))
					),
					true
				)
			)
		),
		true
	);

	return [
		...imports,
		...enums.map(enumAst),
		factory.createVariableStatement(
			undefined,
			factory.createVariableDeclarationList(
				[
					factory.createVariableDeclaration(
						factory.createIdentifier("dictionary"),
						undefined,
						undefined,
						factory.createSatisfiesExpression(
							dictObjAst,
							factory.createTypeReferenceNode(factory.createIdentifier("ModelDictionary"), undefined)
						)
					),
				],
				ts.NodeFlags.Const
			)
		),
		factory.createExportAssignment(undefined, undefined, factory.createIdentifier("dictionary")),
	];
};

/**
 * Convert an AST to a string
 */
export const astToString = (nodes: ts.Node | ts.Node[], printerOptions?: ts.PrinterOptions) => {
	const sourceFile = ts.createSourceFile("print.ts", "", ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
	const printer = ts.createPrinter(printerOptions);

	const output = printer.printList(
		ts.ListFormat.MultiLine,
		ts.factory.createNodeArray(Array.isArray(nodes) ? nodes : [nodes]),
		sourceFile
	);

	return output;
};
