// src/shared/services/email/emailService.js
const fs = require("node:fs");
const path = require("node:path");
const nodemailer = require("nodemailer");
const Handlebars = require("handlebars");
const config = require("../../config");

class EmailService {
  constructor() {
    const {
      CPANEL_EMAIL_HOST,
      CPANEL_EMAIL_PORT,
      CPANEL_EMAIL_SECURE,
      CPANEL_EMAIL_USER,
      CPANEL_EMAIL_PASS,
      CPANEL_EMAIL_FROM,
    } = process.env;

    this.from = CPANEL_EMAIL_FROM;
    this.transport = nodemailer.createTransport({
      host: CPANEL_EMAIL_HOST,
      port: Number(CPANEL_EMAIL_PORT),
      secure: CPANEL_EMAIL_SECURE === "true",
      auth: {
        user: CPANEL_EMAIL_USER,
        pass: CPANEL_EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    this.templateCache = {};
    this.layoutCache = {};

    // Register Handlebars helpers and partials
    this.registerHelpers();
    this.registerPartials();
  }

  // Register custom Handlebars helpers
  registerHelpers() {
    Handlebars.registerHelper("eq", function (a, b) {
      return a === b;
    });

    Handlebars.registerHelper(
      "formatCurrency",
      function (amount, currency = "USD") {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currency,
        }).format(amount);
      }
    );

    Handlebars.registerHelper("formatDate", function (date) {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    });

    Handlebars.registerHelper("capitalize", function (str) {
      if (!str) return "";
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    Handlebars.registerHelper("if_eq", function (a, b, options) {
      return a === b ? options.fn(this) : options.inverse(this);
    });
  }

  // Enhanced registerPartials with better error handling and logging
  registerPartials() {
    // Corrected path to point to src/shared/emails/partials
    const partialsDir = path.join(__dirname, "../../emails/partials");

    if (!fs.existsSync(partialsDir)) {

      try {
        fs.mkdirSync(partialsDir, { recursive: true });
      } catch (error) {
        console.error("❌ Failed to create partials directory:", error);
      }
      return;
    }

    try {
      const partialFiles = fs.readdirSync(partialsDir);


      if (partialFiles.length === 0) {
        this.createDefaultPartials(partialsDir);
        return;
      }

      let registeredCount = 0;
      partialFiles.forEach((file) => {
        if (file.endsWith(".hbs")) {
          const partialName = path.basename(file, ".hbs");
          const partialPath = path.join(partialsDir, file);

          try {
            const partialContent = fs.readFileSync(partialPath, "utf8");

            // Register the partial with Handlebars
            Handlebars.registerPartial(partialName, partialContent);
            registeredCount++;
          } catch (readError) {
            console.error(`❌ Failed to read partial ${file}:`, readError);
          }
        }
      });

      console.log(`🎉 Successfully registered ${registeredCount} partials`);

      // Log all registered partials
      const allPartials = Object.keys(Handlebars.partials);
    } catch (error) {
      console.error("❌ Error registering partials:", error);
    }
  }

  // Create default partials if none exist
  createDefaultPartials(partialsDir) {
    console.log("🔧 Creating default partials...");

    const defaultPartials = {
      header: `
<div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 2px solid #007bff;">
  <h1 style="color: #007bff; margin: 0; font-family: Arial, sans-serif;">
    {{#if companyName}}{{companyName}}{{else}}CosmicForge HealthNet{{/if}}
  </h1>
  {{#if tagline}}
  <p style="color: #6c757d; margin: 5px 0 0 0; font-size: 14px;">{{tagline}}</p>
  {{/if}}
</div>
      `.trim(),

      footer: `
<div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6; margin-top: 30px;">
  <p style="color: #6c757d; margin: 0; font-size: 12px;">
    © {{currentYear}} {{#if companyName}}{{companyName}}{{else}}CosmicForge HealthNet{{/if}}. All rights reserved.
  </p>
  {{#if unsubscribeUrl}}
  <p style="color: #6c757d; margin: 5px 0 0 0; font-size: 12px;">
    <a href="{{unsubscribeUrl}}" style="color: #007bff; text-decoration: none;">Unsubscribe</a>
  </p>
  {{/if}}
</div>
      `.trim(),

      button: `
<div style="text-align: center; margin: 20px 0;">
  <a href="{{url}}" 
     style="display: inline-block; 
            background-color: {{#if color}}{{color}}{{else}}#007bff{{/if}}; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 5px; 
            font-weight: bold;
            font-family: Arial, sans-serif;">
    {{text}}
  </a>
</div>
      `.trim(),
    };

    Object.entries(defaultPartials).forEach(([name, content]) => {
      try {
        const filePath = path.join(partialsDir, `${name}.hbs`);
        fs.writeFileSync(filePath, content, "utf8");

        // Register with Handlebars
        Handlebars.registerPartial(name, content);
        console.log(`✅ Created and registered default partial: ${name}`);
      } catch (error) {
        console.error(`❌ Failed to create default partial ${name}:`, error);
      }
    });
  }

  // Enhanced loadLayout with better error handling
  loadLayout(layoutName) {
    if (!this.layoutCache[layoutName]) {
      // Corrected path to point to src/shared/emails/layouts
      const layoutPath = path.join(
        __dirname,
        "../../emails/layouts",
        `${layoutName}.hbs`
      );

      console.log(`🔍 Loading layout: ${layoutPath}`);

      if (!fs.existsSync(layoutPath)) {
        console.error(`❌ Layout not found: ${layoutPath}`);

        // Create default layout if it doesn't exist
        const layoutsDir = path.dirname(layoutPath);
        if (!fs.existsSync(layoutsDir)) {
          fs.mkdirSync(layoutsDir, { recursive: true });
        }

        this.createDefaultLayout(layoutPath, layoutName);
      }

      try {
        const layoutSource = fs.readFileSync(layoutPath, "utf8");
        console.log(
          `📄 Layout content preview: ${layoutSource.substring(0, 200)}...`
        );

        this.layoutCache[layoutName] = Handlebars.compile(layoutSource);
        console.log(`✅ Layout compiled successfully: ${layoutName}`);
      } catch (error) {
        console.error(`❌ Failed to compile layout ${layoutName}:`, error);
        throw error;
      }
    }

    return this.layoutCache[layoutName];
  }

  // Create default layout
  createDefaultLayout(layoutPath, layoutName) {
    console.log(`🔧 Creating default layout: ${layoutName}`);

    const defaultLayout = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{#if subject}}{{subject}}{{else}}Email from CosmicForge HealthNet{{/if}}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    
    {{> header}}
    
    <div style="padding: 30px 20px;">
      {{{body}}}
    </div>
    
    {{> footer}}
    
  </div>
</body>
</html>
    `.trim();

    try {
      fs.writeFileSync(layoutPath, defaultLayout, "utf8");
      console.log(`✅ Created default layout: ${layoutName}`);
    } catch (error) {
      console.error(`❌ Failed to create default layout:`, error);
      throw error;
    }
  }

  // Enhanced loadTemplate with better error handling
  loadTemplate(templateName) {
    if (!this.templateCache[templateName]) {
      // Corrected path to point to src/shared/emails/templates
      const templatePath = path.join(
        __dirname,
        "../../emails/templates",
        `${templateName}.hbs`
      );

      console.log(`🔍 Loading template: ${templatePath}`);

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templatePath}`);
      }

      try {
        const templateSource = fs.readFileSync(templatePath, "utf8");
        console.log(
          `📄 Template content preview: ${templateSource.substring(0, 200)}...`
        );

        this.templateCache[templateName] = Handlebars.compile(templateSource);
        console.log(`✅ Template compiled successfully: ${templateName}`);
      } catch (error) {
        console.error(`❌ Failed to compile template ${templateName}:`, error);
        throw error;
      }
    }

    return this.templateCache[templateName];
  }

  /**
   * Enhanced send method with better debugging
   */
  async send(templateName, to, subject, variables = {}, layout = "main") {
    try {
      // console.log(`📧 Preparing to send email: ${templateName} to ${to}`);
      // console.log(`📋 Variables:`, JSON.stringify(variables, null, 2));
      // console.log(`🎨 Using layout: ${layout}`);

      // List current partials before sending
      const currentPartials = Object.keys(Handlebars.partials);
      // console.log(`🧩 Available partials: [${currentPartials.join(", ")}]`);

      // 1. Compile the template content
      // console.log(`1️⃣ Compiling template: ${templateName}`);
      const template = this.loadTemplate(templateName);
      const templateContent = template(variables);
      // console.log(`✅ Template compiled successfully`);

      // 2. Compile the layout with template content injected
      // console.log(`2️⃣ Compiling layout: ${layout}`);
      const layoutTemplate = this.loadLayout(layout);

      const layoutVariables = {
        ...variables,
        body: templateContent,
        subject: subject,
        currentYear: new Date().getFullYear(),
        social: config.social
      };

      // console.log(`📋 Layout variables:`, Object.keys(layoutVariables));

      const htmlContent = layoutTemplate(layoutVariables);
      // console.log(`✅ Layout compiled successfully`);

      // 3. Prepare mail options
      const mailOptions = {
        from: this.from,
        to: to,
        subject: subject,
        html: htmlContent
      };

      // 4. Send the email via cPanel SMTP
      // console.log(`3️⃣ Sending email via SMTP...`);
      const result = await this.transport.sendMail(mailOptions);
      console.log(`✅ Email sent successfully: ${templateName} to ${to}`);
      // console.log(`📧 Message ID: ${result.messageId}`);

      return result;
    } catch (error) {
      console.error("❌ Failed to send email:", error.message);
      console.error("🔍 Error details:", {
        templateName,
        to,
        subject,
        errorMessage: error.message,
        smtpConfig: {
          host: process.env.CPANEL_EMAIL_HOST,
          port: process.env.CPANEL_EMAIL_PORT,
          from: this.from,
        }
      });
      // Do not re-throw if we want non-blocking behavior elsewhere, 
      // but let's keep it re-throwing for now so caller knows if it failed
      throw error;
    }
  }

  // Rest of your methods remain the same...
  async sendSimple(templateName, to, subject, variables = {}) {
    try {
      const template = this.loadTemplate(templateName);
      const htmlContent = template({
        ...variables,
        currentYear: new Date().getFullYear(),
      });

      const mailOptions = {
        from: this.from,
        to: to,
        subject: subject,
        html: htmlContent,
      };

      const result = await this.transport.sendMail(mailOptions);
      console.log(`✅ Simple email sent via cPanel: ${templateName} to ${to}`);
      console.log(`📧 Message ID: ${result.messageId}`);

      return result;
    } catch (error) {
      console.error("❌ Failed to send simple email via cPanel SMTP:", error);
      throw error;
    }
  }

  async sendRaw(to, subject, htmlContent) {
    try {
      const mailOptions = {
        from: this.from,
        to: to,
        subject: subject,
        html: htmlContent,
      };

      const result = await this.transport.sendMail(mailOptions);
      console.log(`✅ Raw email sent via cPanel to ${to}`);
      console.log(`📧 Message ID: ${result.messageId}`);

      return result;
    } catch (error) {
      console.error("❌ Failed to send raw email via cPanel SMTP:", error);
      throw error;
    }
  }

  preview(templateName, variables = {}, layout = "main") {
    try {
      const template = this.loadTemplate(templateName);
      const templateContent = template(variables);

      if (layout) {
        const layoutTemplate = this.loadLayout(layout);
        return layoutTemplate({
          ...variables,
          body: templateContent,
          currentYear: new Date().getFullYear(),
        });
      }

      return templateContent;
    } catch (error) {
      console.error("❌ Failed to preview email:", error);
      throw error;
    }
  }

  async verifyConnection() {
    try {
      await this.transport.verify();
      console.log("✅ cPanel SMTP connection verified successfully");
      return true;
    } catch (error) {
      console.error("❌ cPanel SMTP connection failed:", error);
      return false;
    }
  }

  async sendTestEmail(testEmail) {
    try {
      const testHTML = `
        <h2>🧪 cPanel Email Test</h2>
        <p>This is a test email from CosmicForge HealthNet email service.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>From:</strong> ${this.from}</p>
        <p>If you received this email, your cPanel SMTP configuration is working correctly! ✅</p>
      `;

      const result = await this.sendRaw(
        testEmail,
        "🧪 cPanel Email Service Test",
        testHTML
      );

      return result;
    } catch (error) {
      console.error("❌ Test email failed:", error);
      throw error;
    }
  }

  clearCache() {
    this.templateCache = {};
    this.layoutCache = {};
    console.log("🗑️ Email template cache cleared");
  }

  listPartials() {
    const partials = Object.keys(Handlebars.partials);
    console.log("📋 Registered partials:", partials);
    return partials;
  }

  listTemplates() {
    const templatesDir = path.join(__dirname, "../../emails/templates");
    if (!fs.existsSync(templatesDir)) return [];

    return fs
      .readdirSync(templatesDir)
      .filter((file) => file.endsWith(".hbs"))
      .map((file) => path.basename(file, ".hbs"));
  }

  listLayouts() {
    const layoutsDir = path.join(__dirname, "../../emails/layouts");
    if (!fs.existsSync(layoutsDir)) return [];

    return fs
      .readdirSync(layoutsDir)
      .filter((file) => file.endsWith(".hbs"))
      .map((file) => path.basename(file, ".hbs"));
  }

  getStats() {
    return {
      cacheSize: {
        templates: Object.keys(this.templateCache).length,
        layouts: Object.keys(this.layoutCache).length,
      },
      partials: Object.keys(Handlebars.partials).length,
      availableTemplates: this.listTemplates().length,
      availableLayouts: this.listLayouts().length,
      smtpConfig: {
        host: process.env.CPANEL_EMAIL_HOST,
        port: process.env.CPANEL_EMAIL_PORT,
        secure: process.env.CPANEL_EMAIL_SECURE === "true",
        from: this.from,
      },
    };
  }

  /**
   * Debug method to check what partials are missing
   */
  checkMissingPartials(templateOrLayoutContent) {
    const partialRegex = /\{\{>\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
    const matches = [...templateOrLayoutContent.matchAll(partialRegex)];
    const requiredPartials = matches.map((match) => match[1]);
    const availablePartials = Object.keys(Handlebars.partials);
    const missing = requiredPartials.filter(
      (partial) => !availablePartials.includes(partial)
    );

    return {
      required: requiredPartials,
      available: availablePartials,
      missing: missing,
    };
  }
}

module.exports = new EmailService();
