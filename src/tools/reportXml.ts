import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const UPLOAD_REPORT_XML: Tool = {
  name: "salesforce_upload_report_xml",
  description: `Upload XML to generate or update reports in Salesforce.
  
Examples:
1. Create a new report:
   - reportName: "Monthly Sales Summary"
   - folderId: "00l5e000000XXXXX" (optional - uploads to user's private reports by default)
   - xmlContent: "<Report xmlns=..."
   - isDeveloperName: false

2. Update existing report:
   - reportId: "00O5e000000XXXXX"
   - xmlContent: "<Report xmlns=..."
   
Note: XML must follow Salesforce report metadata format. For custom report types, 
ensure the report type exists in your org before uploading.`,
  inputSchema: {
    type: "object",
    properties: {
      reportName: {
        type: "string",
        description: "Name for the new report (required for new reports)",
        optional: true
      },
      reportId: {
        type: "string", 
        description: "Report ID to update an existing report",
        optional: true
      },
      folderId: {
        type: "string",
        description: "Folder ID where the report should be saved (optional)",
        optional: true
      },
      xmlContent: {
        type: "string",
        description: "XML content for the report in Salesforce report metadata format"
      },
      isDeveloperName: {
        type: "boolean",
        description: "If true, reportName is treated as the API name instead of the display name",
        optional: true
      }
    },
    required: ["xmlContent"]
  }
};

export interface UploadReportXmlArgs {
  reportName?: string;
  reportId?: string;
  folderId?: string;
  xmlContent: string;
  isDeveloperName?: boolean;
}

// Function to validate XML content
function validateReportXml(xmlContent: string): { isValid: boolean; error?: string } {
  try {
    // Check if content is valid XML
    if (!xmlContent.trim().startsWith('<')) {
      return {
        isValid: false,
        error: "Invalid XML format: Content must be XML starting with '<'"
      };
    }

    // Check if it's a Salesforce report XML
    if (!xmlContent.includes('<Report xmlns') && !xmlContent.includes('<report>')) {
      return {
        isValid: false,
        error: "XML content doesn't appear to be a valid Salesforce report definition"
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `XML validation error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export async function handleUploadReportXml(conn: any, args: UploadReportXmlArgs) {
  const { reportName, reportId, folderId, xmlContent, isDeveloperName = false } = args;

  try {
    // Validate input parameters
    if (!reportId && !reportName) {
      return {
        content: [{
          type: "text",
          text: "Either reportName (for new reports) or reportId (for updates) must be provided"
        }],
        isError: true,
      };
    }

    // Validate XML content
    const xmlValidation = validateReportXml(xmlContent);
    if (!xmlValidation.isValid) {
      return {
        content: [{
          type: "text",
          text: xmlValidation.error!
        }],
        isError: true,
      };
    }

    // For updating existing reports
    if (reportId) {
      // First verify the report exists
      try {
        await conn.sobject('Report').retrieve(reportId);
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Report with ID ${reportId} not found or you don't have access to it`
          }],
          isError: true,
        };
      }

      // Use Salesforce Metadata API to update the report
      const result = await conn.metadata.update('Report', {
        fullName: reportId,
        content: Buffer.from(xmlContent).toString('base64')
      });

      if (result.success) {
        return {
          content: [{
            type: "text",
            text: `Report successfully updated with ID: ${reportId}`
          }],
          isError: false,
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `Failed to update report: ${result.errors?.join(', ') || 'Unknown error'}`
          }],
          isError: true,
        };
      }
    } 
    // For creating new reports
    else {
      // Generate API name from display name if needed
      const developerName = isDeveloperName 
        ? reportName 
        : reportName!.replace(/[^a-zA-Z0-9]/g, '_');

      // Prepare report metadata
      const reportMetadata = {
        fullName: developerName,
        content: Buffer.from(xmlContent).toString('base64')
      };

      // Specify folder if provided
      if (folderId) {
        // @ts-ignore - JSForce types don't include this property but it's supported
        reportMetadata.folderId = folderId;
      }

      // Use Metadata API to create the report
      const result = await conn.metadata.create('Report', reportMetadata);

      if (result.success) {
        return {
          content: [{
            type: "text",
            text: `Report "${reportName}" successfully created with ID: ${result.id}`
          }],
          isError: false,
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `Failed to create report: ${result.errors?.join(', ') || 'Unknown error'}`
          }],
          isError: true,
        };
      }
    }
  } catch (error) {
    // Enhanced error handling
    const errorMessage = error instanceof Error ? error.message : String(error);
    let enhancedError = errorMessage;

    // Customize error messages for common issues
    if (errorMessage.includes('INVALID_CROSS_REFERENCE_KEY')) {
      enhancedError = `Invalid folder ID or report folder access issue. Please check that the folder exists and you have proper permissions.`;
    } else if (errorMessage.includes('INSUFFICIENT_ACCESS')) {
      enhancedError = `Insufficient permissions to create or modify reports. Please check your Salesforce user permissions.`;
    } else if (errorMessage.includes('INVALID_TYPE')) {
      enhancedError = `Invalid report type in XML. Ensure the report type specified in the XML exists in your Salesforce org.`;
    }

    return {
      content: [{
        type: "text",
        text: `Error uploading report XML: ${enhancedError}`
      }],
      isError: true,
    };
  }
}
