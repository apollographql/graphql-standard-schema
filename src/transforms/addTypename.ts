import {
  Kind,
  visit,
  type FieldNode,
  type OperationDefinitionNode,
} from "graphql";
import { GraphQLStandardSchemaGenerator } from "../index.ts";

const TYPENAME_FIELD: FieldNode = {
  kind: Kind.FIELD,
  name: {
    kind: Kind.NAME,
    value: "__typename",
  },
};

export const addTypename: GraphQLStandardSchemaGenerator.DocumentTransform = (
  doc
) =>
  visit(doc, {
    SelectionSet: {
      enter(node, _key, parent) {
        // Don't add __typename to OperationDefinitions.
        if (
          parent &&
          (parent as OperationDefinitionNode).kind === Kind.OPERATION_DEFINITION
        ) {
          return;
        }

        // No changes if no selections.
        const { selections } = node;
        if (!selections) {
          return;
        }

        // If selections already have a __typename, or are part of an
        // introspection query, do nothing.
        const skip = selections.some((selection) => {
          return (
            selection.kind === Kind.FIELD &&
            (selection.name.value === "__typename" ||
              selection.name.value.lastIndexOf("__", 0) === 0)
          );
        });
        if (skip) {
          return;
        }

        // Create and return a new SelectionSet with a __typename Field.
        return {
          ...node,
          selections: [TYPENAME_FIELD, ...selections],
        };
      },
    },
  });
