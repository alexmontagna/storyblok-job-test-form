import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { CONTACT } from "../../constants";

const resend = new Resend(import.meta.env.RESEND_API_KEY);
const supabase = createClient(import.meta.env.SUPABASE_URL, import.meta.env.SUPABASE_KEY);

export async function POST({ request }) {
    try {
        const data = await request.json();

        if (data.website && data.website.trim() !== "") {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: "Bot detected.",
                }),
                { status: 400 }
            );
        }

        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const requiredFields = [
            { key: "first_name", label: "First name" },
            { key: "last_name", label: "Last name" },
            { key: "email", label: "Email" },
            { key: "message", label: "Message" },
        ];

        for (const field of requiredFields) {
            const value = (data[field.key] || "").trim();
            if (!value) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        message: `${field.label} is required.`,
                    }),
                    { status: 400 }
                );
            }
            if (field.key === "email" && !emailPattern.test(value)) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        message: "Invalid email address.",
                    }),
                    { status: 400 }
                );
            }
        }

        const { error: dbError } = await supabase
            .from("contacts")
            .insert({
                first_name: data.first_name.trim(),
                last_name: data.last_name.trim(),
                email: data.email.trim(),
                message: data.message.trim(),
            });

        if (dbError) {
            console.error("Supabase insertion error:", dbError);
            return new Response(
                JSON.stringify({
                    success: false,
                    message: "Database insertion error.",
                }),
                { status: 500 }
            );
        }

        const userChoiceMailTo = data.mailto && data.mailto.trim() !== '' ? data.mailto.trim() : CONTACT.MAILTO;
        const result = await resend.emails.send({
            from: `${CONTACT.FROM_NAME} <${CONTACT.FROM_EMAIL}>`,
            to: [userChoiceMailTo],
            subject: `${data.first_name} ${CONTACT.SUBJECT}`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h1 style="color: #73467b;">New Contact Message</h1>
                    <h2 style="margin-top: 0.8rem; margin-bottom: 0.2rem;">Name</h2>
                    <p>
                        <strong>First Name:</strong> ${data.first_name}<br/>
                        <strong>Last Name:</strong> ${data.last_name}
                    </p>
                    <h2 style="margin-top: 0.8rem; margin-bottom: 0.2rem;">Email</h2>
                    <p>
                        <a href="mailto:${data.email}" style="color: #73467b;">${data.email}</a>
                    </p>
                    <h2 style="margin-top: 0.8rem; margin-bottom: 0.2rem;">Message</h2>
                    <p style="white-space: pre-line;">${data.message}</p>
                </div>
            `,
        });

        if (result.error || result.status === "bounced" || result.status === "complained") {
            console.error("Email sending error:", result.error || `Status: ${result.status}`);
            return new Response(
                JSON.stringify({
                    success: false,
                    message: "Error sending email.",
                }),
                { status: 500 }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Thanks for your message!",
            }),
            { status: 200 }
        );
    } catch (error) {
        console.error("General error:", error);
        return new Response(
            JSON.stringify({
                success: false,
                message: "Internal error. Try again later.",
            }),
            { status: 500 }
        );
    }
}
