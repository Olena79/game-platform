import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";

export const PrivacyPolicyPage = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen px-4 py-12 md:py-16">
      <div className="max-w-3xl mx-auto">
        <h1
          className="text-3xl md:text-4xl font-bold mb-8"
          style={{ color: isDark ? "#44aaff" : "var(--text)" }}
        >
          {t("nav.privacy_policy")}
        </h1>

        <div
          className="prose prose-invert max-w-none"
          style={{ color: isDark ? "rgba(180,200,255,0.9)" : "var(--text)" }}
        >
          {/* Last Updated */}
          <p style={{ fontSize: "14px", opacity: 0.7, marginBottom: "24px" }}>
            {t("legal.last_updated")}: 2026-09-02
          </p>

          {/* Introduction */}
          <section className="mb-8">
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "600",
                marginBottom: "16px",
                color: isDark ? "#44aaff" : "var(--text)",
              }}
            >
              {t("legal.privacy_intro_title")}
            </h2>
            <p>{t("legal.privacy_intro_text")}</p>
          </section>

          {/* Data Collection */}
          <section className="mb-8">
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "600",
                marginBottom: "16px",
                color: isDark ? "#44aaff" : "var(--text)",
              }}
            >
              {t("legal.data_collection_title")}
            </h2>
            <p>{t("legal.data_collection_text")}</p>
            <ul
              style={{
                listStyle: "disc",
                marginLeft: "20px",
                marginTop: "12px",
              }}
            >
              <li>{t("legal.data_account")}</li>
              <li>{t("legal.data_profile")}</li>
              <li>{t("legal.data_games")}</li>
              <li>{t("legal.data_messages")}</li>
              <li>{t("legal.data_telegram")}</li>
            </ul>
          </section>

          {/* Data Usage */}
          <section className="mb-8">
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "600",
                marginBottom: "16px",
                color: isDark ? "#44aaff" : "var(--text)",
              }}
            >
              {t("legal.data_usage_title")}
            </h2>
            <p>{t("legal.data_usage_text")}</p>
            <ul
              style={{
                listStyle: "disc",
                marginLeft: "20px",
                marginTop: "12px",
              }}
            >
              <li>{t("legal.usage_account")}</li>
              <li>{t("legal.usage_games")}</li>
              <li>{t("legal.usage_notifications")}</li>
              <li>{t("legal.usage_communications")}</li>
              <li>{t("legal.usage_analytics")}</li>
            </ul>
          </section>

          {/* Third-Party Services */}
          <section className="mb-8">
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "600",
                marginBottom: "16px",
                color: isDark ? "#44aaff" : "var(--text)",
              }}
            >
              {t("legal.third_party_title")}
            </h2>
            <p>{t("legal.third_party_text")}</p>
            <ul
              style={{
                listStyle: "disc",
                marginLeft: "20px",
                marginTop: "12px",
              }}
            >
              <li>
                <strong>MongoDB Atlas</strong> - {t("legal.service_database")}
              </li>
              <li>
                <strong>LiveKit</strong> - {t("legal.service_video")}
              </li>
              <li>
                <strong>Telegram Bot</strong> - {t("legal.service_telegram")}
              </li>
              <li>
                <strong>Google OAuth</strong> - {t("legal.service_google")}
              </li>
              <li>
                <strong>Cloudinary</strong> - {t("legal.service_cloudinary")}
              </li>
              <li>
                <strong>Google Drive</strong> - {t("legal.service_drive")}
              </li>
            </ul>
          </section>

          {/* Data Security */}
          <section className="mb-8">
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "600",
                marginBottom: "16px",
                color: isDark ? "#44aaff" : "var(--text)",
              }}
            >
              {t("legal.security_title")}
            </h2>
            <p>{t("legal.security_text")}</p>
          </section>

          {/* User Rights */}
          <section className="mb-8">
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "600",
                marginBottom: "16px",
                color: isDark ? "#44aaff" : "var(--text)",
              }}
            >
              {t("legal.user_rights_title")}
            </h2>
            <p>{t("legal.user_rights_text")}</p>
            <ul
              style={{
                listStyle: "disc",
                marginLeft: "20px",
                marginTop: "12px",
              }}
            >
              <li>{t("legal.right_access")}</li>
              <li>{t("legal.right_delete")}</li>
              <li>{t("legal.right_modify")}</li>
              <li>{t("legal.right_export")}</li>
            </ul>
          </section>

          {/* Retention */}
          <section className="mb-8">
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "600",
                marginBottom: "16px",
                color: isDark ? "#44aaff" : "var(--text)",
              }}
            >
              {t("legal.retention_title")}
            </h2>
            <p>{t("legal.retention_text")}</p>
          </section>

          {/* Children */}
          <section className="mb-8">
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "600",
                marginBottom: "16px",
                color: isDark ? "#44aaff" : "var(--text)",
              }}
            >
              {t("legal.children_title")}
            </h2>
            <p>{t("legal.children_text")}</p>
          </section>

          {/* Changes */}
          <section className="mb-8">
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "600",
                marginBottom: "16px",
                color: isDark ? "#44aaff" : "var(--text)",
              }}
            >
              {t("legal.changes_title")}
            </h2>
            <p>{t("legal.changes_text")}</p>
          </section>

          {/* Contact */}
          <section className="mb-8">
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "600",
                marginBottom: "16px",
                color: isDark ? "#44aaff" : "var(--text)",
              }}
            >
              {t("legal.contact_title")}
            </h2>
            <p>{t("legal.contact_text")}</p>
            <p style={{ marginTop: "12px" }}>
              Email:{" "}
              <a
                href="mailto:foksysmile@gmail.com"
                style={{ color: isDark ? "#44aaff" : "var(--accent)" }}
              >
                gamesclubsenses@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
