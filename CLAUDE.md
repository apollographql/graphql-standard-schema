# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GraphQL Standard Schema package that creates Standard Schema compliant validators for GraphQL operation responses. The package implements the Standard Schema V1 specification to validate GraphQL data against type definitions.

## Commands

```bash
# Run tests
npm test

# Run a single test (use test name pattern)
node --test --test-name-pattern="validates valid string data"

# Build (not yet implemented - returns TODO)
npm run build
```

## Architecture

### Core Implementation

The package provides a `GraphQLStandardSchemaGenerator` class (`src/index.ts`) that:
- Accepts GraphQL schemas as either `GraphQLSchema` objects or `DocumentNode` ASTs
- Generates Standard Schema compliant validators for GraphQL operation responses
- Uses GraphQL's execution engine with custom field resolvers for strict type validation

### Key Components

**GraphQLStandardSchemaGenerator Methods:**
- `getDataSchema(document)` - Returns a validator for the data portion of GraphQL responses (fully implemented)
- `getResponseSchema(document)` - Returns a validator for complete GraphQL responses including errors (stub only)
- `replaceSchema(schema)` - Updates the schema used for validation

**Validation Strategy:**
The implementation leverages GraphQL's `execute()` function with custom field resolvers that:
- Validate scalar types (String, Int, Float, Boolean) with strict type checking
- Handle nullable vs non-nullable fields correctly by checking `GraphQLNonNull` wrapper types
- Return Standard Schema V1 compliant results with either `{ value: T }` or `{ issues: [...] }`

### Standard Schema Integration

The package implements the Standard Schema V1 interface (`src/standard-schema-spec.ts`) with:
- Proper TypeScript generics for type safety
- Support for both sync validation (implemented) and async (returns error)
- JSON Schema source interface (stub - `toJSONSchema()` not implemented)

## Development Status

**Implemented:**
- Core validation logic for `getDataSchema()`
- All GraphQL scalar type validation
- Nullable/non-nullable field handling
- Arrays and nested object validation
- Comprehensive test suite with 7 passing tests

**Not Implemented:**
- Build process to compile TypeScript to `dist/`
- `getResponseSchema()` for full response validation
- `toJSONSchema()` method for JSON Schema generation
- Support for GraphQL interfaces, unions, and custom scalars

## Testing

Tests are in `test/index.ts` and cover:
- Query, mutation, and subscription validation
- All scalar types (String, Int, Float, Boolean)
- Nullable vs non-nullable fields
- Arrays with nested objects
- Type mismatch detection

The test suite uses Node.js built-in test runner without external testing frameworks.