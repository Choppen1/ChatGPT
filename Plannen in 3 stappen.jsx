import React, { useEffect, useMemo, useRef, useState } from "react";
// Optionele libraries (in deze Playground beschikbaar). Fallbacks zorgen dat de app ook draait zonder deze libs.
let XLSX: any = null;
try { XLSX = require("xlsx"); } catch { /* optioneel */ }

// Geëxtraheerde modules (testbaar)
import { DAYS, DAY_LABEL, type Category, type Task, type Placed, type Grid, type Day } from "./src/types";
import { uid, clamp, toHHMM } from "./src/utils";
import { autoSchedule as runAutoSchedule } from "./src/scheduler";
import { generateICSContent } from "./src/export-ics";
import { generateTasksCSV } from "./src/export-csv";
import { mapRowsToTasks } from "./src/import-wizard";

// LocalStorage hooks
function useLocalState<T>(key: string, init: T){
  const [val, setVal] = useState<T>(() => {
    try{ const s = localStorage.getItem(key); return s ? JSON.parse(s) as T : init; }catch{ return init; }
  });
  useEffect(()=>{ try{ localStorage.setItem(key, JSON.stringify(val)); }catch{} }, [key, val]);
  return [val, setVal] as const;
}

// Hoofdcomponent
export default function PlanningApp(){
  // Stap-navigatie
  const [step, setStep] = useLocalState<number>("plan.step", 1);

  // Instellingen rooster
  const [startHour, setStartHour] = useLocalState<number>("plan.start", 7);
  const [endHour, setEndHour] = useLocalState<number>("plan.end", 22);
  const hours = useMemo(()=> Array.from({length: clamp(endHour-startHour, 1, 24)}, (_,i)=> startHour+i), [startHour, endHour]);

  // Categorieën (palette in uitklapmenu)
  const [cats, setCats] = useLocalState<Category[]>("plan.cats", [
    { id: uid("cat"), naam: "les op school", kleur: "#2563eb", context: "school" },
    { id: uid("cat"), naam: "stage",        kleur: "#16a34a", context: "stage" },
    { id: uid("cat"), naam: "huiswerk",     kleur: "#f59e0b", context: "thuis" },
    { id: uid("cat"), naam: "sport",        kleur: "#ef4444", context: "overig" },
    { id: uid("cat"), naam: "slaap",        kleur: "#6b7280", context: "overig" },
    { id: uid("cat"), naam: "vrij",         kleur: "#10b981", context: "overig" },
  ]);
  const [activeCat, setActiveCat] = useLocalState<string| null>("plan.activeCat", null);

  // Rooster: mapping day->hour->catId | null
  const emptyGrid: Grid = useMemo(()=>{
    const g: any = {}; DAYS.forEach(d => { g[d] = {}; hours.forEach(h => g[d][h] = null); }); return g;
  }, [hours]);
  const [grid, setGrid] = useLocalState<Grid>("plan.grid", emptyGrid);
  useEffect(()=>{ // als urenrange wijzigt, grid bijsnijden/aanvullen
    const next: any = {}; DAYS.forEach(d => {
      next[d] = {}; hours.forEach(h => next[d][h] = (grid[d] ?? {})[h] ?? null);
    });
    setGrid(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours.length]);

  // Taken (stap 2)
  const [tasks, setTasks] = useLocalState<Task[]>("plan.tasks", []);

  // Geplande taken (stap 3): elk blok is 1 uur, span = aantal uren
  const [placed, setPlaced] = useLocalState<Placed[]>("plan.placed", []);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useLocalState<boolean>("plan.drawer", true);

  // Hulpfuncties rooster bewerken (klik-en-verf)
  const paintRef = useRef<{painting: boolean, catId: string|null}>({painting:false, catId:null});
  function handleCellDown(ev: React.MouseEvent, d: typeof DAYS[number], h: number){
    // voorkom overschilderen als je het uitklapmenu gebruikt
    const tag = (ev.target as HTMLElement).tagName;
    if(tag === "SELECT" || tag === "OPTION") return;
    if(!activeCat){ return; }
    paintRef.current = { painting: true, catId: activeCat };
    setGrid(prev => ({...prev, [d]: {...prev[d], [h]: activeCat}}));
  }
  function handleCellEnter(d: typeof DAYS[number], h: number){
    if(!paintRef.current.painting) return;
    setGrid(prev => ({...prev, [d]: {...prev[d], [h]: paintRef.current.catId}}));
  }
  function handleMouseUp(){ paintRef.current.painting = false; }
  useEffect(()=>{
    window.addEventListener("mouseup", handleMouseUp);
    return ()=> window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  // Uren per categorie
  const catTotals = useMemo(() => {
    const counts: Record<string, number> = {};
    DAYS.forEach(d => hours.forEach(h => {
      const c = grid[d][h]; if(c){ counts[c] = (counts[c]||0)+1; }
    }));
    const arr = cats.map(c => ({...c, uren: counts[c.id]||0}));
    const totaal = arr.reduce((s,a)=>s+a.uren,0);
    return { arr, totaal };
  }, [grid, cats, hours]);

  // Vrije uren (niet ingekleurd)
  const vrijeUren = useMemo(()=> DAYS.reduce((sum,d)=> sum + hours.filter(h => !grid[d][h]).length, 0), [grid, hours]);

  // Autoscheduler: plan taken in uren die bij de context passen (bijv. 'huiswerk' uit stap 1)
  function autoSchedule(){
    const { placements, updatedTasks } = runAutoSchedule(tasks, cats, grid, hours);
    setPlaced(placements);
    setTasks(updatedTasks);
    setStep(3);
  }

  // Export: ICS (agenda)
  function downloadICS(){
    if(!placed.length){
      alert("Geen geplande items om te exporteren.");
      return;
    }
    const content = generateICSContent(placed, tasks);
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "planning.ics";
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  // CSV export van taken
  function exportTasksCSV(){
    const content = generateTasksCSV(tasks);
    const blob = new Blob([content], { type: "text/csv;charset=utf-8"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "taken.csv"; a.click();
  }

  // XLSX import wizard (IO-overzicht of Huiswerkrooster)
  const fileRef = useRef<HTMLInputElement|null>(null);
  const [importPreview, setImportPreview] = useState<{headers: string[], rows: any[]}|null>(null);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
  const [sheetName, setSheetName] = useState<string>("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>){
    const file = e.target.files?.[0]; if(!file){ return; }
    if(!XLSX){ alert("XLSX-bibliotheek niet geladen. Upload een CSV, of probeer later nog eens."); return; }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const names = workbook.SheetNames;
      setSheetNames(names);
      const first = names[0]; setSheetName(first);
      const ws = workbook.Sheets[first];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
      const headers = (json[0] as any[]).map((v:any)=> String(v||""));
      setImportPreview({ headers, rows: json.slice(1) });
      setHeaderRowIdx(0);
    };
    reader.readAsArrayBuffer(file);
  }

  function applyHeaderRow(){
    if(!importPreview) return;
    const headers = (importPreview.rows[headerRowIdx] || []).map((v:any)=> String(v||""));
    const rows = importPreview.rows.slice(headerRowIdx+1).map(r => {
      const obj: any = {}; headers.forEach((h, i) => obj[h||`kolom_${i+1}`] = r[i]); return obj;
    });
    setImportPreview({ headers, rows });
  }

  function mapImportToTasks(){
    if(!importPreview) return;
    // Bouw keyed rows van de array-rows
    const keyedRows = importPreview.rows.map(r => {
      const obj: Record<string, unknown> = {};
      importPreview.headers.forEach((h, i) => { obj[h || `kolom_${i+1}`] = (r as any)[i]; });
      return obj;
    });
    const nieuw = mapRowsToTasks(importPreview.headers, keyedRows);
    setTasks(prev => [...prev, ...nieuw]);
    setImportPreview(null);
    if(fileRef.current) fileRef.current.value = "";
    setStep(2);
  }

  // UI helpers
  function CatBadge({c}:{c:Category}){
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded-full shadow-sm border text-sm" style={{backgroundColor: c.kleur+"22", borderColor: c.kleur+"55"}}>
        <span className="w-3 h-3 rounded-full" style={{backgroundColor: c.kleur}}/>
        <span className="capitalize">{c.naam}</span>
      </div>
    );
  }

  function Stepper(){
    const steps = [
      {nr:1, titel:"Stap 1 – weekrooster"},
      {nr:2, titel:"Stap 2 – to‑do lijst"},
      {nr:3, titel:"Stap 3 – zet in agenda"},
    ];
    return (
      <div className="grid grid-cols-3 gap-2 mb-4">
        {steps.map(s => (
          <button key={s.nr} onClick={()=>setStep(s.nr)}
            className={`p-3 rounded-2xl border shadow-sm text-left transition ${step===s.nr?"bg-blue-600 text-white":"bg-white hover:bg-blue-50"}`}>
            <div className="text-xs opacity-70">{`fase ${s.nr}`}</div>
            <div className="font-semibold">{s.titel}</div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4">
      <div className="max-w-[1200px] mx-auto">
        <header className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Planner in 3 stappen</h1>
            <p className="text-sm opacity-70">Eerst je weekrooster inkleuren, dan je to‑do vullen, daarna automatisch plannen in je agenda. Alles blijft lokaal bewaard.</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-100" onClick={()=>{localStorage.clear(); location.reload();}}>reset</button>
            <button className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-100" onClick={exportTasksCSV}>export taken</button>
            <button className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-100" onClick={downloadICS} disabled={!placed.length}>export agenda</button>
          </div>
        </header>

        <Stepper/>

        {/* Drawer – uitklapmenu met kleuren */}
        <div className="relative">
          <button onClick={()=>setDrawerOpen(v=>!v)} className="fixed top-24 right-4 z-30 px-3 py-2 rounded-xl shadow bg-white border">{drawerOpen?"sluit palette":"open palette"}</button>
          {drawerOpen && (
            <aside className="fixed top-20 right-4 w-80 z-20 bg-white border rounded-2xl shadow-xl p-4 space-y-3">
              <h3 className="font-semibold">Kleuren en context</h3>
              <div className="flex flex-wrap gap-2">
                {cats.map(c => (
                  <button key={c.id} onClick={()=> setActiveCat(c.id)} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${activeCat===c.id?"ring-2 ring-blue-500":""}`} style={{borderColor: c.kleur+"77", backgroundColor: activeCat===c.id? c.kleur+"22":"white"}}>
                    <span className="w-4 h-4 rounded-full" style={{backgroundColor:c.kleur}}/>
                    <span className="capitalize">{c.naam}</span>
                  </button>
                ))}
              </div>
              <hr/>
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Nieuwe categorie</h4>
                <NewCategory onAdd={(c)=> setCats(prev => [...prev, c])}/>
              </div>
              <hr/>
              <div className="text-sm opacity-80">Tip: klik en sleep over het rooster om cellen te kleuren, of gebruik het uitklapmenu in elk hokje om direct een categorie te kiezen.</div>
            </aside>
          )}
        </div>

        {step===1 && (
          <section className="bg-white rounded-2xl shadow p-4 border">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="flex items-center gap-2"> 
                <label className="text-sm">startuur</label>
                <input type="number" min={0} max={23} value={startHour} onChange={e=> setStartHour(clamp(parseInt(e.target.value||"0"),0,23))} className="w-20 px-2 py-1 border rounded-lg"/>
              </div>
              <div className="flex items-center gap-2"> 
                <label className="text-sm">einduur</label>
                <input type="number" min={1} max={24} value={endHour} onChange={e=> setEndHour(clamp(parseInt(e.target.value||"0"),1,24))} className="w-20 px-2 py-1 border rounded-lg"/>
              </div>
              <div className="ml-auto text-sm opacity-70">vrije uren deze week: <b>{vrijeUren}</b></div>
            </div>
            <div className="overflow-auto">
              <table className="w-full border-separate" style={{borderSpacing:"0"}}>
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white border p-2 text-left">uur</th>
                    {DAYS.map(d => (
                      <th key={d} className="border p-2 capitalize">{DAY_LABEL[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hours.map(h => (
                    <tr key={h}>
                      <td className="sticky left-0 bg-white border p-1 text-sm w-[70px]">{toHHMM(h)}</td>
                      {DAYS.map(d => {
                        const catId = grid[d][h];
                        const c = cats.find(x => x.id===catId);
                        return (
                          <td key={d+"_"+h}
                              onMouseDown={(e)=>handleCellDown(e,d,h)}
                              onMouseEnter={()=>handleCellEnter(d,h)}
                              className="border h-10"
                              title={c? `${DAY_LABEL[d]} ${toHHMM(h)} – ${c.naam}`: `${DAY_LABEL[d]} ${toHHMM(h)} – leeg`}
                              style={{ background: c ? c.kleur+"33" : "white", padding: 0 }}>
                            <select
                              value={catId || ""}
                              onChange={(e)=>{
                                const val = e.target.value || null;
                                setGrid(prev => ({...prev, [d]: {...prev[d], [h]: val}}));
                              }}
                              className="w-full h-10 text-xs bg-transparent px-1 focus:outline-none">
                              <option value="">—</option>
                              {cats.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.naam}</option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {catTotals.arr.map(c => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <CatBadge c={c}/><span className="opacity-70">{c.uren} u</span>
                </div>
              ))}
              <div className="ml-auto">
                <button className="px-4 py-2 rounded-xl bg-blue-600 text-white" onClick={()=> setStep(2)}>volgende stap</button>
              </div>
            </div>
          </section>
        )}

        {step===2 && (
          <section className="bg-white rounded-2xl shadow p-4 border space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">To‑do lijst en IO/Opdrachten</h2>
              <div className="text-xs opacity-70">voeg taken toe of importeer je sjabloon (Excel)</div>
              <div className="ml-auto flex gap-2">
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden"/>
                <button className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-100" onClick={()=> fileRef.current?.click()}>importeer</button>
                <button className="px-3 py-2 rounded-xl bg-blue-600 text-white" onClick={autoSchedule} disabled={!tasks.length}>plan automatisch</button>
              </div>
            </div>

            {/* Nieuw taakje */}
            <NewTask onAdd={(t)=> setTasks(prev => [t, ...prev])}/>

            {/* Overzicht */}
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="p-2 text-left">titel</th>
                    <th className="p-2">minuten</th>
                    <th className="p-2">deadline</th>
                    <th className="p-2">context</th>
                    <th className="p-2">io/opdracht</th>
                    <th className="p-2">prio</th>
                    <th className="p-2">status</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(t => (
                    <tr key={t.id} className="border-t">
                      <td className="p-2">{t.titel}</td>
                      <td className="p-2 text-center">{t.minuten}</td>
                      <td className="p-2 text-center">{t.deadline||"–"}</td>
                      <td className="p-2 text-center capitalize">{t.context}</td>
                      <td className="p-2 text-center">{t.io||""}</td>
                      <td className="p-2 text-center">{"★".repeat(t.prioriteit)}</td>
                      <td className="p-2 text-center">{t.status}</td>
                      <td className="p-2 text-right">
                        <button className="text-blue-600 mr-2" onClick={()=> setTasks(prev => prev.map(x => x.id===t.id? {...x, status: x.status==="klaar"?"open":"klaar"}: x))}>{t.status==="klaar"?"markeer open":"markeer klaar"}</button>
                        <button className="text-rose-600" onClick={()=> setTasks(prev => prev.filter(x => x.id!==t.id))}>verwijder</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Import wizard UI */}
            {importPreview && (
              <div className="p-4 border rounded-2xl bg-slate-50">
                <div className="font-semibold mb-2">Importwizard</div>
                {!!sheetNames.length && <div className="text-sm opacity-80 mb-2">Gevonden sheets: {sheetNames.join(", ")}. (De eerste is geladen.)</div>}
                <div className="flex items-center gap-3 mb-3">
                  <label className="text-sm">kopregel op rij</label>
                  <input type="number" min={1} max={50} value={headerRowIdx+1} onChange={e=> setHeaderRowIdx(Math.max(0, Number(e.target.value)-1))} className="w-24 px-2 py-1 border rounded-lg"/>
                  <button className="px-3 py-1.5 rounded-lg border bg-white" onClick={applyHeaderRow}>pas toe</button>
                  <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-white" onClick={mapImportToTasks}>importeer als taken</button>
                </div>
                <div className="overflow-auto max-h-64 bg-white border rounded-xl">
                  <table className="w-full text-xs">
                    <thead><tr>{importPreview.headers.map((h,i)=> <th key={i} className="p-2 border-b bg-slate-50 text-left">{h||`kolom_${i+1}`}</th>)}</tr></thead>
                    <tbody>{importPreview.rows.slice(0,10).map((r,ri)=> (
                      <tr key={ri} className="border-t">{importPreview.headers.map((_,ci)=> <td key={ci} className="p-2">{String(r[ci]??"")}</td>)}</tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {step===3 && (
          <section className="bg-white rounded-2xl shadow p-4 border space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Agenda-overzicht en filters</h2>
              <div className="ml-auto flex gap-2">
                <button className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-100" onClick={()=> setStep(2)}>terug naar to‑do</button>
                <button className="px-3 py-2 rounded-xl bg-blue-600 text-white" onClick={downloadICS} disabled={!placed.length}>download .ics</button>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="p-2 text-left">dag</th>
                    <th className="p-2 text-left">blok</th>
                    <th className="p-2 text-left">taak</th>
                    <th className="p-2 text-left">context</th>
                    <th className="p-2 text-left">io/opdracht</th>
                    <th className="p-2 text-left">actie</th>
                  </tr>
                </thead>
                <tbody>
                  {placed.map((p, i) => {
                    const t = tasks.find(x => x.id===p.taskId); if(!t) return null;
                    const blok = `${toHHMM(p.hour)}–${toHHMM(p.hour+p.span)}`;
                    return (
                      <tr key={i} className="border-t">
                        <td className="p-2 capitalize">{DAY_LABEL[p.day]}</td>
                        <td className="p-2">{blok}</td>
                        <td className="p-2">{t.titel}</td>
                        <td className="p-2 capitalize">{t.context}</td>
                        <td className="p-2">{t.io||""}</td>
                        <td className="p-2">
                          <button className="text-rose-600" onClick={()=> setPlaced(prev => prev.filter((_,idx)=> idx!==i))}>verwijder</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!placed.length && <div className="text-sm opacity-70 p-3">Nog niets ingepland. Ga naar stap 2 en klik op "plan automatisch" of voeg handmatig blokken toe in het rooster.</div>}
            </div>
          </section>
        )}

        <footer className="text-xs opacity-70 mt-6">
          Gebaseerd op het stappenplan: weekrooster → to‑do → agenda. Gegevens blijven lokaal in de browser.
        </footer>
      </div>
    </div>
  );
}

function NewCategory({ onAdd }:{ onAdd:(c:Category)=>void }){
  const [naam, setNaam] = useState("");
  const [kleur, setKleur] = useState("#8b5cf6");
  const [ctx, setCtx] = useState<Category["context"]>("overig");
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <input className="px-2 py-1 border rounded-lg col-span-2" value={naam} onChange={e=> setNaam(e.target.value)} placeholder="naam"/>
        <input className="px-2 py-1 border rounded-lg" type="color" value={kleur} onChange={e=> setKleur(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm">context</label>
        <select className="px-2 py-1 border rounded-lg" value={ctx} onChange={e=> setCtx(e.target.value as any)}>
          <option value="thuis">thuis</option>
          <option value="stage">stage</option>
          <option value="school">school</option>
          <option value="overig">overig</option>
        </select>
        <button className="ml-auto px-3 py-1.5 rounded-lg bg-slate-900 text-white" onClick={()=>{ if(!naam.trim()) return; onAdd({id: uid("cat"), naam, kleur, context: ctx}); setNaam(""); }}>toevoegen</button>
      </div>
    </div>
  );
}

function NewTask({ onAdd }:{ onAdd:(t:Task)=>void }){
  const [titel, setTitel] = useState("");
  const [minuten, setMinuten] = useState(60);
  const [deadline, setDeadline] = useState("");
  const [context, setContext] = useState<Task["context"]>("thuis");
  const [io, setIo] = useState("");
  const [prio, setPrio] = useState<1|2|3>(2);
  return (
    <div className="p-3 border rounded-xl bg-slate-50">
      <div className="grid md:grid-cols-6 grid-cols-2 gap-2">
        <input className="px-2 py-2 border rounded-lg md:col-span-2" value={titel} onChange={e=> setTitel(e.target.value)} placeholder="titel of opdracht"/>
        <input type="number" min={15} step={15} className="px-2 py-2 border rounded-lg" value={minuten} onChange={e=> setMinuten(Number(e.target.value||60))} placeholder="min"/>
        <input type="date" className="px-2 py-2 border rounded-lg" value={deadline} onChange={e=> setDeadline(e.target.value)} />
        <select className="px-2 py-2 border rounded-lg" value={context} onChange={e=> setContext(e.target.value as any)}>
          <option value="thuis">thuis</option>
          <option value="stage">stage</option>
          <option value="school">school</option>
          <option value="overig">overig</option>
        </select>
        <input className="px-2 py-2 border rounded-lg" value={io} onChange={e=> setIo(e.target.value)} placeholder="IO of opdrachtcode"/>
        <select className="px-2 py-2 border rounded-lg" value={prio} onChange={e=> setPrio(Number(e.target.value) as any)}>
          <option value={1}>prio 1</option>
          <option value={2}>prio 2</option>
          <option value={3}>prio 3</option>
        </select>
        <button className="px-3 py-2 rounded-lg bg-blue-600 text-white md:col-span-1" onClick={()=>{
          if(!titel.trim()) return;
          onAdd({ id: uid("t"), titel, minuten, deadline: deadline || undefined, context, io: io || undefined, prioriteit: prio, status: "open" });
          setTitel(""); setMinuten(60); setDeadline(""); setContext("thuis"); setIo(""); setPrio(2);
        }}>voeg toe</button>
      </div>
    </div>
  );
}
