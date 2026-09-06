/**
 * Domain fallback resolver.
 *
 * The charts group scores by `competency.domain.name` from a PostgREST embed.
 * If that embed ever resolves null (stale seed rows, RLS hiccups, or a project
 * whose competencies aren't linked), every score collapses into "Unknown" and
 * the radar/bar charts go blank. This fills gaps with two direct lookups:
 * competencies(domain_id) + competency_domains — no embed involved.
 *
 * Scores that still can't be mapped keep domain "Unknown" so callers can
 * surface an actionable notice instead of a mystery bar.
 */

export async function resolveMissingDomains(
  supabase: any,
  scores: any[]
): Promise<{ scores: any[]; unmapped: number }> {
  const missingIds = [...new Set(
    scores
      .filter((s) => {
        const d = (s.competency as any)?.domain;
        const name = typeof d === "string" ? d : d?.name;
        return !name;
      })
      .map((s) => s.competency_id || (s.competency as any)?.id)
      .filter(Boolean)
  )] as string[];

  if (missingIds.length === 0) return { scores, unmapped: 0 };

  try {
    const { data: comps } = await supabase
      .from("competencies")
      .select("id, domain_id")
      .in("id", missingIds);
    const domainIds = [...new Set((comps || []).map((c: any) => c.domain_id).filter(Boolean))] as string[];
    let domainMap = new Map<string, string>();
    if (domainIds.length > 0) {
      const { data: domains } = await supabase
        .from("competency_domains")
        .select("id, name")
        .in("id", domainIds);
      domainMap = new Map((domains || []).map((d: any) => [d.id, d.name]));
    }
    const compToDomain = new Map((comps || []).map((c: any) => [c.id, domainMap.get(c.domain_id) || ""]));

    let unmapped = 0;
    const fixed = scores.map((s) => {
      const d = (s.competency as any)?.domain;
      const name = typeof d === "string" ? d : d?.name;
      if (name) return s;
      const cid = s.competency_id || (s.competency as any)?.id;
      const resolved = (cid && compToDomain.get(cid)) || "";
      if (!resolved) {
        unmapped++;
        return s;
      }
      return { ...s, competency: { ...(s.competency as object), domain: { name: resolved } } };
    });
    return { scores: fixed, unmapped };
  } catch {
    const unmapped = scores.filter((s) => {
      const d = (s.competency as any)?.domain;
      return !(typeof d === "string" ? d : d?.name);
    }).length;
    return { scores, unmapped };
  }
}
