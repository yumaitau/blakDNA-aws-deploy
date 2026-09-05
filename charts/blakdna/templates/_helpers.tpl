{{- define "blakdna.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- define "blakdna.environment" -}}
{{- $secretName := required "runtimeSecret.name is required" .Values.runtimeSecret.name -}}
- { name: DATABASE_HOST, value: {{ required "database.host is required" .Values.database.host | quote }} }
- { name: DATABASE_PORT, value: {{ .Values.database.port | quote }} }
- { name: DATABASE_NAME, value: {{ .Values.database.name | quote }} }
- { name: DATABASE_USER, value: {{ .Values.database.user | quote }} }
- { name: DATABASE_SSLMODE, value: {{ .Values.database.sslmode | quote }} }
- { name: BETTER_AUTH_URL, value: {{ required "publicOrigin is required" .Values.publicOrigin | quote }} }
- { name: HERMES_BASE_URL, value: {{ .Values.hermes.baseUrl | quote }} }
- { name: SMTP_PORT, value: "465" }
- { name: DATABASE_PASSWORD, valueFrom: { secretKeyRef: { name: {{ $secretName | quote }}, key: {{ required "runtimeSecret.databasePasswordKey is required" .Values.runtimeSecret.databasePasswordKey | quote }} } } }
- { name: BLAKDNA_NOTIFICATION_SMTP_HOSTS, valueFrom: { secretKeyRef: { name: {{ $secretName | quote }}, key: SMTP_HOST } } }
{{- range $key := list "BETTER_AUTH_SECRET" "BLAKDNA_ENCRYPTION_KEY" "HERMES_API_TOKEN" "SMTP_HOST" "SMTP_FROM" "SMTP_USER" "SMTP_PASSWORD" }}
- { name: {{ $key }}, valueFrom: { secretKeyRef: { name: {{ $secretName | quote }}, key: {{ $key }} } } }
{{- end }}
{{- end -}}
{{- define "blakdna.fullname" -}}
{{- printf "%s-%s" .Release.Name (include "blakdna.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- define "blakdna.image" -}}
{{- printf "%s@%s" (required "image.repository is required" .Values.image.repository) (required "image.digest is required" .Values.image.digest) -}}
{{- end -}}
