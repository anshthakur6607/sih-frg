/**
 * Admin What-If Simulator - Natural language scenario forecasting
 */
"use client";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function SimulatorPage() {
  const [scenario, setScenario] = useState("If 50% of NSSO officers complete GIS Advanced training");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const simulate = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "")}/api/admin/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("sb-token")||""}` },
        body: JSON.stringify({ scenario })
      });
      if (!res.ok) {
        // Fallback direct to AI service
        const aiRes = await fetch("http://127.0.0.1:8000/api/ai/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": "demo-key" },
          body: JSON.stringify({ scenario, snapshot: [] })
        });
        const j = await aiRes.json();
        setResult(j.data || j);
        return;
      }
      const j = await res.json();
      setResult(j.data);
    } catch (e:any) {
      // Mock fallback for offline demo
      setResult({
        predicted_averages: { Statistical: 3.2, Technical: 2.9, "Digital Governance": 2.1, Behavioural: 3.0 },
        improvement: { Statistical: 0.4, Technical: 0.6 },
        affected_users: 30,
        reasoning: `Mock: ${scenario} would raise Technical from 2.3 to 2.9 (+0.6) for 30 users. Configure AI_SERVICE_API_KEY for live Gemini.`
      });
    } finally { setLoading(false); }
  };

  const chartData = result ? Object.entries(result.predicted_averages || {}).map(([name, value]: any)=>({ name, value, improvement: result.improvement?.[name] || 0 })) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">What-If Capability Simulator</h1>
        <p className="text-slate-600 text-sm">Predict org-wide skill impact before committing budget (Gemini 1.5 Pro)</p>
      </div>
      <div className="bg-white rounded-lg p-6 border space-y-4">
        <label className="block text-sm font-medium">Scenario (natural language)</label>
        <textarea value={scenario} onChange={e=>setScenario(e.target.value)} rows={3} className="w-full border rounded-lg p-3 text-sm" placeholder="If 30% of DIID staff finish Cybersecurity..." />
        <button onClick={simulate} disabled={loading} className="bg-[#1e40af] text-white px-6 py-2 rounded font-medium hover:bg-[#1e3a8a] disabled:opacity-50">{loading ? "Simulating..." : "Run Simulation"}</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      {result && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-6 border">
            <h3 className="font-semibold mb-3">Predicted Averages</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{fontSize: 11}} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis domain={[0,5]} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1e40af" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-lg p-6 border">
            <h3 className="font-semibold mb-3">Reasoning</h3>
            <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded">{result.reasoning}</p>
            <div className="mt-4 space-y-2">
              {Object.entries(result.improvement || {}).map(([k,v]:any)=>(
                <div key={k} className="flex justify-between text-sm"><span>{k}</span><span className="font-medium text-green-600">+{v}</span></div>
              ))}
              <div className="text-xs text-slate-500">Affected users: {result.affected_users}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
