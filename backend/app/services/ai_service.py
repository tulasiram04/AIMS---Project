import json
from typing import TypedDict, Annotated, Optional
from sqlalchemy.orm import Session
from app.models.inventory import Reconciliation, Discrepancy
from app.core.config import settings

try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

try:
    from langgraph.graph import StateGraph, END
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False


def _get_model():
    if GENAI_AVAILABLE and settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        return genai.GenerativeModel("gemini-2.5-flash")
    return None


import re

def _clean_ai_response(text: str) -> str:
    if not text:
        return "AI Insights temporarily unavailable."
    lower_text = text.lower()
    if any(err in lower_text for err in ["429", "quota", "overloaded", "limit exceeded", "api failure", "error:"]):
        return "AI Insights temporarily unavailable."
    
    # Strip markdown headers, bold headers, and raw code block symbols
    cleaned = text
    cleaned = cleaned.replace("**", "").replace("*", "")
    cleaned = re.sub(r'^#+\s+', '', cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r'```\w*\n?', '', cleaned)
    cleaned = cleaned.replace('`', '')
    return cleaned.strip()

def _safe_generate(model, prompt: str) -> str:
    try:
        response = model.generate_content(prompt)
        if not response or not response.text:
            return "AI Insights temporarily unavailable."
        return _clean_ai_response(response.text)
    except Exception:
        return "AI Insights temporarily unavailable."


# ─── LangGraph State ────────────────────────────────────────────────
class ReconciliationState(TypedDict):
    recon_data: dict
    discrepancies: list
    validation_result: str
    analysis_result: str
    recommendations_result: str
    executive_summary_result: str
    error: Optional[str]


# ─── Agent Nodes ─────────────────────────────────────────────────────
def validation_agent(state: ReconciliationState) -> ReconciliationState:
    model = _get_model()
    if not model:
        state["validation_result"] = "AI not configured"
        return state

    data = state["recon_data"]
    discrepancies = state["discrepancies"]

    prompt = f"""You are an Inventory Validation Agent for an enterprise IT infrastructure audit.

Analyze the following inventory data for quality issues:

Total CSV (recorded) assets: {data['total_csv']}
Total JSON (live) assets: {data['total_json']}
Missing assets (in CSV but not live): {data['missing']}
Untracked assets (live but not in CSV): {data['untracked']}
Configuration mismatches: {data['config_mismatch']}
Naming mismatches: {data['naming_mismatch']}

Sample discrepancies (up to 10):
{json.dumps(discrepancies[:10], indent=2, default=str)}

Provide a validation assessment covering:
1. Data quality issues detected
2. Duplicate or missing value patterns
3. Data integrity concerns
4. Overall data quality score (out of 100)

Be concise and professional. Use actual numbers from the data."""

    state["validation_result"] = _safe_generate(model, prompt)
    return state


def analysis_agent(state: ReconciliationState) -> ReconciliationState:
    model = _get_model()
    if not model:
        state["analysis_result"] = "AI not configured"
        return state

    data = state["recon_data"]
    discrepancies = state["discrepancies"]

    prompt = f"""You are an AI Analysis Agent for enterprise inventory reconciliation.

Reconciliation Results:
- CSV assets: {data['total_csv']}
- Live assets: {data['total_json']}
- Missing: {data['missing']}
- Untracked: {data['untracked']}
- Config mismatches: {data['config_mismatch']}
- Naming mismatches: {data['naming_mismatch']}

Discrepancy details (up to 15):
{json.dumps(discrepancies[:15], indent=2, default=str)}

Perform:
1. Root Cause Analysis — identify likely reasons for each discrepancy category
2. Risk Assessment — rate overall risk (Critical/High/Medium/Low) with justification
3. Impact Analysis — business impact of unresolved discrepancies
4. Trend indicators — patterns suggesting systemic vs. isolated issues

Use only the provided data. Do not fabricate statistics."""

    state["analysis_result"] = _safe_generate(model, prompt)
    return state


def recommendation_agent(state: ReconciliationState) -> ReconciliationState:
    model = _get_model()
    if not model:
        state["recommendations_result"] = "AI not configured"
        return state

    data = state["recon_data"]
    analysis = state.get("analysis_result", "")

    prompt = f"""You are a Recommendation Agent for enterprise IT inventory management.

Based on this reconciliation:
- Missing assets: {data['missing']}
- Untracked assets: {data['untracked']}
- Config mismatches: {data['config_mismatch']}
- Naming mismatches: {data['naming_mismatch']}

Previous analysis:
{analysis[:1500]}

Generate actionable recommendations:
1. Immediate corrective actions (prioritized P1-P4)
2. Process improvements to prevent recurrence
3. Automation opportunities
4. Compliance remediation steps

Format as a prioritized list. Be specific and actionable."""

    state["recommendations_result"] = _safe_generate(model, prompt)
    return state


def executive_summary_agent(state: ReconciliationState) -> ReconciliationState:
    model = _get_model()
    if not model:
        state["executive_summary_result"] = "AI not configured"
        return state

    data = state["recon_data"]
    total_assets = max(data["total_csv"], 1)
    compliance = round(((total_assets - data["missing"]) / total_assets) * 100, 1)
    total_issues = data["missing"] + data["untracked"] + data["config_mismatch"] + data["naming_mismatch"]

    prompt = f"""You are an Executive Summary Agent producing a report for C-level executives and auditors.

Inventory Reconciliation Summary:
- Total recorded assets: {data['total_csv']}
- Total live assets: {data['total_json']}
- Compliance rate: {compliance}%
- Total discrepancies found: {total_issues}
  - Missing from live infrastructure: {data['missing']}
  - Untracked (not in records): {data['untracked']}
  - Configuration mismatches: {data['config_mismatch']}
  - Naming mismatches: {data['naming_mismatch']}

Key findings from analysis:
{state.get('analysis_result', 'N/A')[:1000]}

Top recommendations:
{state.get('recommendations_result', 'N/A')[:1000]}

Write a professional executive summary (300-500 words) suitable for board presentation.
Include: overall health assessment, key risks, recommended actions, and compliance status.
Use only the provided data. Never fabricate statistics."""

    state["executive_summary_result"] = _safe_generate(model, prompt)
    return state


# ─── Graph Builder ───────────────────────────────────────────────────
def _build_graph():
    if not LANGGRAPH_AVAILABLE:
        return None

    builder = StateGraph(ReconciliationState)
    builder.add_node("validation", validation_agent)
    builder.add_node("analysis", analysis_agent)
    builder.add_node("recommendations", recommendation_agent)
    builder.add_node("executive_summary", executive_summary_agent)

    builder.set_entry_point("validation")
    builder.add_edge("validation", "analysis")
    builder.add_edge("analysis", "recommendations")
    builder.add_edge("recommendations", "executive_summary")
    builder.add_edge("executive_summary", END)

    return builder.compile()


_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = _build_graph()
    return _graph


# ─── Public Service Class ───────────────────────────────────────────
class AIService:
    def __init__(self):
        if GENAI_AVAILABLE and settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)

    def _get_recon_data(self, db: Session, recon_id: int):
        recon = db.query(Reconciliation).filter(Reconciliation.id == recon_id).first()
        if not recon:
            return None, None, None
        discrepancies = db.query(Discrepancy).filter(
            Discrepancy.reconciliation_id == recon_id
        ).all()
        data = {
            "total_csv": recon.total_csv_assets,
            "total_json": recon.total_json_assets,
            "missing": recon.missing_assets_count,
            "untracked": recon.untracked_assets_count,
            "config_mismatch": recon.config_mismatch_count,
            "naming_mismatch": recon.naming_mismatch_count,
        }
        disc_list = [
            {
                "type": d.discrepancy_type.value,
                "csv_asset_id": d.csv_asset_id,
                "json_asset_id": d.json_asset_id,
                "severity": d.severity,
                "details": d.details,
            }
            for d in discrepancies
        ]
        return recon, data, disc_list

    async def run_full_analysis(self, db: Session, recon_id: int):
        """Run the full LangGraph multi-agent pipeline."""
        recon, data, disc_list = self._get_recon_data(db, recon_id)
        if not recon:
            return None, None, None

        graph = get_graph()
        if graph:
            initial_state: ReconciliationState = {
                "recon_data": data,
                "discrepancies": disc_list,
                "validation_result": "",
                "analysis_result": "",
                "recommendations_result": "",
                "executive_summary_result": "",
                "error": None,
            }
            try:
                result = graph.invoke(initial_state)
                analysis = (result.get("validation_result", "") or "") + "\n\n" + (result.get("analysis_result", "") or "")
                recs_text = result.get("recommendations_result", "") or ""
                summary = result.get("executive_summary_result", "") or ""
                recommendations = {"recommendations": [{"text": recs_text}]}
                return analysis, recommendations, summary
            except Exception as e:
                return await self._fallback_analysis(db, recon_id)
        else:
            return await self._fallback_analysis(db, recon_id)

    async def _fallback_analysis(self, db: Session, recon_id: int):
        """Fallback when LangGraph is not available — call agents sequentially."""
        analysis = await self.analyze_reconciliation(db, recon_id)
        recommendations = await self.generate_recommendations(db, recon_id)
        summary = await self.generate_executive_summary(db, recon_id)
        return analysis, recommendations, summary

    async def analyze_reconciliation(self, db: Session, recon_id: int):
        if not GENAI_AVAILABLE or not settings.GEMINI_API_KEY:
            return None
        try:
            recon, data, disc_list = self._get_recon_data(db, recon_id)
            if not recon:
                return None
            state: ReconciliationState = {
                "recon_data": data,
                "discrepancies": disc_list,
                "validation_result": "",
                "analysis_result": "",
                "recommendations_result": "",
                "executive_summary_result": "",
                "error": None,
            }
            state = validation_agent(state)
            state = analysis_agent(state)
            return (state.get("validation_result", "") or "") + "\n\n" + (state.get("analysis_result", "") or "")
        except Exception:
            return None

    async def generate_recommendations(self, db: Session, recon_id: int):
        if not GENAI_AVAILABLE or not settings.GEMINI_API_KEY:
            return None
        try:
            recon, data, disc_list = self._get_recon_data(db, recon_id)
            if not recon:
                return None
            state: ReconciliationState = {
                "recon_data": data,
                "discrepancies": disc_list,
                "validation_result": "",
                "analysis_result": "",
                "recommendations_result": "",
                "executive_summary_result": "",
                "error": None,
            }
            state = recommendation_agent(state)
            return {"recommendations": [{"text": state.get("recommendations_result", "")}]}
        except Exception:
            return None

    async def generate_executive_summary(self, db: Session, recon_id: int):
        if not GENAI_AVAILABLE or not settings.GEMINI_API_KEY:
            return None
        try:
            recon, data, disc_list = self._get_recon_data(db, recon_id)
            if not recon:
                return None
            state: ReconciliationState = {
                "recon_data": data,
                "discrepancies": disc_list,
                "validation_result": "",
                "analysis_result": "",
                "recommendations_result": "",
                "executive_summary_result": "",
                "error": None,
            }
            state = executive_summary_agent(state)
            return state.get("executive_summary_result", "")
        except Exception:
            return None

    async def chatbot_query(self, query: str, db: Session, recon_id=None):
        if not GENAI_AVAILABLE or not settings.GEMINI_API_KEY:
            return "AI Insights temporarily unavailable."
        try:
            context = ""
            if recon_id:
                recon, data, disc_list = self._get_recon_data(db, recon_id)
                if recon:
                    context = f"""
Context — Reconciliation #{recon_id}:
- CSV assets: {data['total_csv']}, Live assets: {data['total_json']}
- Missing: {data['missing']}, Untracked: {data['untracked']}
- Config mismatches: {data['config_mismatch']}, Naming mismatches: {data['naming_mismatch']}
- Executive summary: {(recon.executive_summary or 'Not generated')[:500]}

Discrepancies (sample):
{json.dumps(disc_list[:5], indent=2, default=str)}
"""
            prompt = f"""You are an AI assistant for an enterprise inventory reconciliation system.
Answer the user's question using only the provided data. If no data is available, say so.
Do not fabricate any statistics or asset information.

CRITICAL INSTRUCTIONS:
- Keep your response short, concise, and direct by default. Do NOT write long narratives or paragraphs unless the user explicitly asks for detailed explanations, long logs, or a full report.
- Organize and present information using clean structural elements such as markdown tables and bulleted lists. Prefer structured visual presentations over dense paragraphs.
- Ensure all tables and lists are well-formed in standard GFM markdown format.

{context}

User Question: {query}"""

            model = _get_model()
            if not model:
                return "AI Insights temporarily unavailable."
            return _safe_generate(model, prompt)
        except Exception:
            return "AI Insights temporarily unavailable."


ai_service = AIService()
