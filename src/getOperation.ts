import {
  getOperationAST,
  type DocumentNode,
  type OperationDefinitionNode,
} from "graphql";
import { assert } from "./assert.ts";

export function getOperation(document: DocumentNode): OperationDefinitionNode {
  const operation = getOperationAST(document);
  assert(
    operation,
    "Provided document does not contain a unique operation definition"
  );
  return operation;
}
