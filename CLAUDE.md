# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `@apollo/graphql-standard-schema`, a GraphQL Standard Schema package that creates Standard Schema V1 compliant validators for GraphQL operations. The package validates:

- Operation responses (data and errors)
- Operation data only
- Fragment values
- Input variables

It supports bidirectional validation with custom scalar serialization/deserialization and JSON Schema generation.

## Commands

```bash
# Run tests
npm test


# Run a single test (use test name pattern)
npm test -- --test-name-pattern="validates valid string data"

# Run tests and update snapshots
npm test -- --test-update-snapshots

# Build TypeScript to dist/
npm run build

# Clean build artifacts
npm run clean

# Prepare for publishing (clean + build)
npm run prepack
```

## Architecture

### Core Implementation

The package provides a `GraphQLStandardSchemaGenerator` class (`src/GraphQLStandardSchemaGenerator.ts`) that:

- Accepts GraphQL schemas as either `GraphQLSchema` objects or `DocumentNode` ASTs
- Generates Standard Schema V1 compliant validators for GraphQL operations
- Supports custom scalar types with bidirectional serialization/deserialization
- Uses custom parsing and validation logic that uses GraphQLs schema scalar types for input validation
- Generates JSON Schema representations compatible with JSON Schema Draft 2020-12 and OpenAI

### Key Methods

**GraphQLStandardSchemaGenerator Methods:**

- `getDataSchema(document, variables?)` - Returns a bidirectional validator for the data portion of GraphQL operation responses
- `getResponseSchema(document)` - Returns a bidirectional validator for complete GraphQL responses (data + errors + extensions)
- `getFragmentSchema(document, { fragmentName?, variables? })` - Returns a bidirectional validator for GraphQL fragment values
- `getVariablesSchema(document)` - Returns a bidirectional validator for GraphQL operation input variables
- `replaceSchema(schema)` - Updates the schema used for validation

All schema methods return **bidirectional validation schemas** with three validation modes:

- `schema.normalize` - Validates and normalizes serialized data (default)
- `schema.deserialize` - Deserializes from serialized format to runtime format
- `schema.serialize` - Serializes from runtime format to serialized format

### Validation Strategy

The implementation uses GraphQL's parsing infrastructure combined with custom logic in (`src/utils/parseData.ts`, `src/utils/parseVariables.ts`) with:

- Strict scalar type validation (String, Int, Float, Boolean, ID, custom scalars)
- Bidirectional validation supporting both serialization and deserialization
- Nullable vs non-nullable field handling
- Enum validation
- Array and nested object validation
- Type coercion and normalization
- Standard Schema V1 compliant results: `{ value: T }` or `{ issues: [...] }`

### Schema Building

Schema generation (`src/schema/`) includes:

- `buildOperationSchema.ts` - Builds JSON Schema for operation responses
- `buildFragmentSchema.ts` - Builds JSON Schema for fragment values
- `buildVariablesSchema.ts` - Builds JSON Schema for input variables
- `buildOutputSchema.ts` - Handles output type schema generation
- `buildInputSchema.ts` - Handles input type schema generation
- `responseShapeSchema.ts` - Defines the GraphQL response envelope structure

### Standard Schema Integration

The package implements:

- Full Standard Schema V1 compliance (`@standard-schema/spec`)
- Experimental StandardJSONSchema support (not yet stable in spec)
- JSON Schema generation via `toJSONSchema()` helper
- TypeScript generics for full type safety with `TypedDocumentNode`
- Composition utilities for combining schemas (`composeStandardSchemas`)

### Additional Features

- **Document Transforms**: Apply transformations to documents before validation (default: `addTypename`)
- **JSON Schema Options**: Control nullable properties, additionalProperties, and OpenAI compatibility
- **Zod Integration**: `zodToExperimentalStandardJSONSchema` for converting Zod schemas
- **Custom Scalars**: Full support with separate serialized/deserialized JSON Schema definitions

## Implementation Status

**Fully Implemented:**

- ✅ All core validation methods (`getDataSchema`, `getResponseSchema`, `getFragmentSchema`, `getVariablesSchema`)
- ✅ Bidirectional validation (normalize, deserialize, serialize)
- ✅ Custom scalar support with serialization/deserialization
- ✅ JSON Schema generation with `toJSONSchema()` helper
- ✅ Standard Schema V1 compliance
- ✅ TypeScript support with `TypedDocumentNode`
- ✅ All GraphQL scalar types (String, Int, Float, Boolean, ID)
- ✅ Enums
- ✅ Nullable/non-nullable field handling
- ✅ Arrays and nested objects
- ✅ Input types and variables validation
- ✅ Fragment validation with type conditions
- ✅ Build process (TypeScript compilation to `dist/`)
- ✅ Comprehensive test suite (221 tests, ~97% coverage)
- ✅ Document transforms
- ✅ Schema composition utilities
- ✅ OpenAI JSON Schema compatibility mode

**Known Limitations:**

- StandardJSONSchema interface support is experimental (spec not yet stable)

## Testing

Tests are organized in `test/`:

- `getDataSchema.test.ts` - Data validation tests
- `getResponseSchema.test.ts` - Response validation tests
- `getFragmentSchema.test.ts` - Fragment validation tests
- `getVariablesSchema.test.ts` - Variables validation tests
- `composeStandardSchemas.test.ts` - Schema composition tests
- `types.test.ts` - TypeScript type tests

The test suite uses Node.js built-in test runner with coverage reporting (221 tests, 96.71% coverage).
