from product_sources.models import SourceAuditLog
from product_sources.security import redact_sensitive_data


class AuditService:
    def log(
        self,
        *,
        action: str,
        actor=None,
        product_id: str = '',
        provider: str = '',
        source_product_id: str = '',
        dry_run: bool = False,
        input_summary: dict | None = None,
        result_summary: dict | None = None,
    ) -> SourceAuditLog:
        safe_actor = actor if getattr(actor, 'is_authenticated', False) else None
        safe_input = redact_sensitive_data(input_summary or {})
        safe_result = redact_sensitive_data(result_summary or {})
        if dry_run:
            return SourceAuditLog(
                action=action,
                actor=safe_actor,
                product_id=product_id,
                provider=provider,
                source_product_id=source_product_id,
                dry_run=True,
                input_summary=safe_input,
                result_summary=safe_result,
            )
        return SourceAuditLog.objects.create(
            action=action,
            actor=safe_actor,
            product_id=product_id,
            provider=provider,
            source_product_id=source_product_id,
            dry_run=dry_run,
            input_summary=safe_input,
            result_summary=safe_result,
        )
