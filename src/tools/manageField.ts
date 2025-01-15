import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { FieldMetadataInfo } from "../types/metadata";

export const MANAGE_FIELD: Tool = {
  name: "salesforce_manage_field",
  description: `Create new custom fields or modify existing fields on any Salesforce object:
  - Field Types: Text, Number, Date, Lookup, Master-Detail, Picklist etc.
  - Properties: Required, Unique, External ID, Length, Scale etc.
  - Relationships: Create lookups and master-detail relationships
  Examples: Add Rating__c picklist to Account, Create Account lookup on Custom Object
  Note: Changes affect metadata and require proper permissions`,
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["create", "update"],
        description: "Whether to create new field or update existing"
      },
      objectName: {
        type: "string",
        description: "API name of the object to add/modify the field"
      },
      fieldName: {
        type: "string",
        description: "API name for the field (without __c suffix)"
      },
      label: {
        type: "string",
        description: "Label for the field",
        optional: true
      },
      type: {
        type: "string",
        enum: ["Checkbox", "Currency", "Date", "DateTime", "Email", "Number", "Percent", 
               "Phone", "Picklist", "MultiselectPicklist", "Text", "TextArea", "LongTextArea", 
               "Html", "Url", "Lookup", "MasterDetail"],
        description: "Field type (required for create)",
        optional: true
      },
      required: {
        type: "boolean",
        description: "Whether the field is required",
        optional: true
      },
      unique: {
        type: "boolean",
        description: "Whether the field value must be unique",
        optional: true
      },
      externalId: {
        type: "boolean",
        description: "Whether the field is an external ID",
        optional: true
      },
      length: {
        type: "number",
        description: "Length for text fields",
        optional: true
      },
      precision: {
        type: "number",
        description: "Precision for numeric fields",
        optional: true
      },
      scale: {
        type: "number",
        description: "Scale for numeric fields",
        optional: true
      },
      referenceTo: {
        type: "string",
        description: "API name of the object to reference (for Lookup/MasterDetail)",
        optional: true
      },
      relationshipLabel: {
        type: "string",
        description: "Label for the relationship (for Lookup/MasterDetail)",
        optional: true
      },
      relationshipName: {
        type: "string",
        description: "API name for the relationship (for Lookup/MasterDetail)",
        optional: true
      },
      deleteConstraint: {
        type: "string",
        enum: ["Cascade", "Restrict", "SetNull"],
        description: "Delete constraint for Lookup fields",
        optional: true
      },
      picklistValues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            isDefault: { type: "boolean", optional: true }
          }
        },
        description: "Values for Picklist/MultiselectPicklist fields",
        optional: true
      },
      description: {
        type: "string",
        description: "Description of the field",
        optional: true
      }
    },
    required: ["operation", "objectName", "fieldName"]
  }
};

export interface ManageFieldArgs {
  operation: 'create' | 'update';
  objectName: string;
  fieldName: string;
  label?: string;
  type?: string;
  required?: boolean;
  unique?: boolean;
  externalId?: boolean;
  length?: number;
  precision?: number;
  scale?: number;
  referenceTo?: string;
  relationshipLabel?: string;
  relationshipName?: string;
  deleteConstraint?: 'Cascade' | 'Restrict' | 'SetNull';
  picklistValues?: Array<{ label: string; isDefault?: boolean }>;
  description?: string;
}

export async function handleManageField(conn: any, args: ManageFieldArgs) {
  const { operation, objectName, fieldName, type, ...fieldProps } = args;

  try {
    if (operation === 'create') {
      if (!type) {
        throw new Error('Field type is required for field creation');
      }

      // Prepare base metadata for the new field
      const metadata: FieldMetadataInfo = {
        fullName: `${objectName}.${fieldName}__c`,
        label: fieldProps.label || fieldName,
        type,
        ...(fieldProps.required && { required: fieldProps.required }),
        ...(fieldProps.unique && { unique: fieldProps.unique }),
        ...(fieldProps.externalId && { externalId: fieldProps.externalId }),
        ...(fieldProps.description && { description: fieldProps.description })
      };

      // Add type-specific properties
      switch (type) {
        case 'MasterDetail':
        case 'Lookup':
          if (fieldProps.referenceTo) {
            metadata.referenceTo = fieldProps.referenceTo;
            metadata.relationshipName = fieldProps.relationshipName;
            metadata.relationshipLabel = fieldProps.relationshipLabel || fieldProps.relationshipName;
            if (type === 'Lookup' && fieldProps.deleteConstraint) {
              metadata.deleteConstraint = fieldProps.deleteConstraint;
            }
          }
          break;

        case 'TextArea':
          metadata.type = 'LongTextArea';
          metadata.length = fieldProps.length || 32768;
          metadata.visibleLines = 3;
          break;

        case 'Text':
          if (fieldProps.length) {
            metadata.length = fieldProps.length;
          }
          break;

        case 'Number':
          if (fieldProps.precision) {
            metadata.precision = fieldProps.precision;
            metadata.scale = fieldProps.scale || 0;
          }
          break;

        case 'Picklist':
        case 'MultiselectPicklist':
          if (fieldProps.picklistValues) {
            metadata.valueSet = {
              valueSetDefinition: {
                sorted: true,
                value: fieldProps.picklistValues.map(val => ({
                  fullName: val.label,
                  default: val.isDefault || false,
                  label: val.label
                }))
              }
            };
          }
          break;
      }

      // Create the field
      const result = await conn.metadata.create('CustomField', metadata);

      if (result && (Array.isArray(result) ? result[0].success : result.success)) {
        return {
          content: [{
            type: "text",
            text: `Successfully created custom field ${fieldName}__c on ${objectName}`
          }],
          isError: false,
        };
      }
    } else {
      // For update, first get existing metadata
      const existingMetadata = await conn.metadata.read('CustomField', [`${objectName}.${fieldName}__c`]);
      const currentMetadata = Array.isArray(existingMetadata) ? existingMetadata[0] : existingMetadata;

      if (!currentMetadata) {
        throw new Error(`Field ${fieldName}__c not found on object ${objectName}`);
      }

      // Prepare update metadata
      const metadata: FieldMetadataInfo = {
        ...currentMetadata,
        ...(fieldProps.label && { label: fieldProps.label }),
        ...(fieldProps.required !== undefined && { required: fieldProps.required }),
        ...(fieldProps.unique !== undefined && { unique: fieldProps.unique }),
        ...(fieldProps.externalId !== undefined && { externalId: fieldProps.externalId }),
        ...(fieldProps.description !== undefined && { description: fieldProps.description }),
        ...(fieldProps.length && { length: fieldProps.length }),
        ...(fieldProps.precision && { precision: fieldProps.precision, scale: fieldProps.scale || 0 })
      };

      // Special handling for picklist values if provided
      if (fieldProps.picklistValues && 
          (currentMetadata.type === 'Picklist' || currentMetadata.type === 'MultiselectPicklist')) {
        metadata.valueSet = {
          valueSetDefinition: {
            sorted: true,
            value: fieldProps.picklistValues.map(val => ({
              fullName: val.label,
              default: val.isDefault || false,
              label: val.label
            }))
          }
        };
      }

      // Update the field
      const result = await conn.metadata.update('CustomField', metadata);

      if (result && (Array.isArray(result) ? result[0].success : result.success)) {
        return {
          content: [{
            type: "text",
            text: `Successfully updated custom field ${fieldName}__c on ${objectName}`
          }],
          isError: false,
        };
      }
    }

    return {
      content: [{
        type: "text",
        text: `Failed to ${operation} custom field ${fieldName}__c`
      }],
      isError: true,
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error ${operation === 'create' ? 'creating' : 'updating'} custom field: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true,
    };
  }
}