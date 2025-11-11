import nodemailer from "nodemailer";

const {
  brevoSmtpHost,
  brevoSmtpPort,
  brevoSmtpUser,
  brevoSmtpPass,
  contactReceiver,
} = useRuntimeConfig();

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.fullname || !body.email || !body.message) {
    throw createError({
      statusCode: 400,
      statusMessage: "Fullname, email, and message are required",
    });
  }

  const transporter = nodemailer.createTransport({
    host: brevoSmtpHost,
    port: brevoSmtpPort,
    secure: false,
    auth: {
      user: brevoSmtpUser,
      pass: brevoSmtpPass,
    },
  });

  console.log([
    brevoSmtpHost,
    brevoSmtpPort,
    brevoSmtpUser,
    brevoSmtpPass,
    contactReceiver,
  ]);

  await transporter.verify();
  await transporter.sendMail({
    from: `"Enpii Studio" <${contactReceiver}>`,
    to: contactReceiver,
    replyTo: body.email,
    subject: `New message from ${body.fullname}`,
    text: `
Fullname: ${body.fullname}
Email: ${body.email}

Message:
${body.message}
  `,
  });

  return { success: true, message: "Message sent successfully" };
});
