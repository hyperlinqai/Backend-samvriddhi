# Production Security Checklist

## ✅ Implemented in This Codebase

### HTTP Security Headers
- [x] Helmet.js enabled (sets X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, etc.)
- [x] CORS configured with specific origins (configurable via env)
- [x] Request body size limited to 10MB

### Authentication
- [x] JWT-based stateless authentication
- [x] Separate access token and refresh token with different secrets
- [x] Password hashing with bcrypt (configurable salt rounds)
- [x] Strong password policy (min 8 chars, uppercase, lowercase, number, special char)
- [x] Token expiry enforcement
- [x] Account deactivation support

### Authorization
- [x] Role-based access control (RBAC) with 4 roles
- [x] Role hierarchy enforcement
- [x] Owner-or-admin resource access pattern
- [x] Self-approval prevention (expenses, discrepancies)

### Input Validation
- [x] Zod schema validation on all endpoints (body, params, query)
- [x] Structured validation error responses
- [x] SQL injection prevention via Prisma ORM (parameterized queries)
- [x] GPS coordinate range validation

### Rate Limiting
- [x] Global rate limiter (configurable window and max requests)
- [x] Standard rate limit headers returned

### Error Handling
- [x] Centralized error handler
- [x] Operational vs. programmer error distinction
- [x] Stack traces hidden in production
- [x] Structured JSON error responses

### Logging & Audit
- [x] Winston structured logging (JSON format)
- [x] Separate error log file
- [x] Request ID tracking for correlation
- [x] Audit log table for all critical actions
- [x] User agent and IP tracking in audit logs

### Docker Security
- [x] Multi-stage build (minimal production image)
- [x] Non-root user in container
- [x] Health check endpoint
- [x] Graceful shutdown handling

---

## 🔲 Pre-Production Checklist (Manual Steps)

### Infrastructure
- [ ] Use managed PostgreSQL (AWS RDS, GCP Cloud SQL, etc.)
- [ ] Enable SSL/TLS termination (NGINX / Load Balancer)
- [ ] Configure database connection pooling (PgBouncer)
- [ ] Set up automated database backups
- [ ] Configure VPC / network isolation

### Secrets Management
- [ ] Use a secrets manager (AWS Secrets Manager, HashiCorp Vault)
- [ ] Rotate JWT secrets periodically
- [ ] Never commit `.env` files to version control
- [ ] Use separate secrets per environment

### Monitoring & Observability
- [ ] Set up APM (Datadog, New Relic, or Grafana)
- [ ] Configure log aggregation (ELK, CloudWatch, Loki)
- [ ] Set up uptime monitoring (Uptime Robot, Pingdom)
- [ ] Configure alerting for error rate spikes
- [ ] Monitor database query performance

### CI/CD & Testing
- [ ] Enable automated lint and type-check in CI
- [ ] Add unit tests for services
- [ ] Add integration tests for critical flows
- [ ] Run `npm audit` in CI pipeline
- [ ] Enable Dependabot or Renovate for dependency updates

### File Uploads
- [ ] Use cloud storage (S3, GCS) for file uploads
- [ ] Validate file MIME types server-side
- [ ] Scan uploaded files for malware
- [ ] Set maximum file size limits per endpoint
- [ ] Generate signed URLs for file access

### API Security
- [ ] Implement API versioning strategy
- [ ] Add request throttling per user
- [ ] Implement IP allowlisting for admin routes
- [ ] Add CSRF protection for cookie-based auth (if applicable)
- [ ] Consider API key authentication for service-to-service calls

### Data Protection
- [ ] Encrypt sensitive data at rest
- [ ] Enable database SSL connections
- [ ] Implement data retention policies
- [ ] Add GDPR/privacy compliance measures
- [ ] Regular security audits and penetration testing
