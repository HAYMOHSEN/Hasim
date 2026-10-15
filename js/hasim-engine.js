/*! Hasim 3.0.0 – Green Hydrogen Engineering Suite. Copyright (c) 2026 Prof. Hani Muhsen. All rights reserved. Owner and developer: Prof. Hani Muhsen. This is licensed, copyright-protected software: copying, modification, reverse engineering or redistribution without written permission is prohibited. */
/* Hasim engine 3.0.0 – headless bundle. */
(function (root) { root.HASIM_ENGINE_VERSION = "3.0.0"; root.HASIM_ENGINE_BUILD = "2026-10-15"; })(typeof window !== "undefined" ? window : globalThis);
/* Hasim – Green Hydrogen Engineering Suite. © 2026 Prof. Hani Muhsen. All rights reserved. */
/* =====================================================================
   Hasim – Green Hydrogen Engineering Suite
   engine-core.js : constants, property functions and component models
   Equations follow the "Green Hydrogen Calculations Manual" (Ed. 3, CM)
   and the "Green Hydrogen Plant Design Manual" (Ed. 1, DM).
   ===================================================================== */
(function (root) {
  'use strict';
  const H2 = root.H2 || (root.H2 = {});

  /* ---------------- Constants (CM Appendix A / DM Appendix E) -------- */
  const C = H2.C = {
    R: 8.31446,          // J/(mol K)
    F: 96485.33,         // C/mol
    M_H2: 2.01588e-3,    // kg/mol
    M_O2: 31.998e-3,
    M_H2O: 18.015e-3,
    Rs: 4124.5,          // J/(kg K) specific gas constant of H2
    b_AN: 7.69e-3,       // m3/kg Abel-Noble co-volume
    rhoN: 0.08994,       // kg/Nm3 (0 degC, 1.01325 bar)
    LHV: 33.32,          // kWh/kg
    HHV: 39.41,          // kWh/kg
    LHV_MJ: 119.96, HHV_MJ: 141.88,
    Etn25: 1.481, Erev25: 1.229, E_LHV: 1.253,
    kSEC: 26.59,         // kWh/(kg V) = 2F/(M 3.6e6)
    w_H2O: 8.937,        // kg water per kg H2 (stoichiometric)
    w_O2: 7.937,         // kg O2 per kg H2
    gamma: 1.405,        // isentropic exponent of H2
    muJT: -0.03,         // K/bar
    AF_st: 34.3,         // kg air per kg H2
    rhoL: 70.85,         // kg/m3 liquid H2 at 20.3 K
    dhvapL: 445.6,       // kJ/kg
    GWP_H2: 11.6,
    TNT: 4.68,           // MJ/kg
    rho_atm_H2: 0.0838,  // kg/m3 at 1 atm 20 degC
    LFL_gm3: 3.35,       // g/m3 (4 vol-%)
    g: 9.81
  };
  const K = t => t + 273.15;
  H2.K = K;
  // own-property lookup: user text such as "constructor" never reaches Object.prototype
  const own = H2.own = (o, k) => (o && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
  // ammonia route: t H₂ per t NH₃ (stoichiometric 0.1776) and synthesis-loop yield (DM 15.2)
  H2.NH3 = { h2: 0.178, loop: 0.97 };
  // one blast-cloud mass for layout, design report and impact assessment (CM 19.8 screening)
  H2.BLAST_MASS_MAX = 100;

  /* ---------------- Properties (CM ch. 2) ---------------------------- */
  H2.Z = (p_bar, T_K) => 1 + C.b_AN * p_bar * 1e5 / (C.Rs * T_K);                       // (2.4)
  H2.rho = (p_bar, T_K) => p_bar * 1e5 / (C.Rs * T_K + C.b_AN * p_bar * 1e5);           // (2.4)/(2.5)
  H2.rhoIdeal = (p_bar, T_K) => p_bar * 1e5 / (C.Rs * T_K);                              // (2.1)
  H2.massInVessel = (V_m3, p_bar, T_K) => V_m3 * H2.rho(p_bar, T_K);                     // (2.5)
  // inverse: pressure at given density (hot-fill, DM 16.3)
  H2.pFromRho = (rho, T_K) => rho * C.Rs * T_K / (1 - rho * C.b_AN) / 1e5;
  // water vapour pressure, Antoine (CM 8.2) -> bar
  H2.pSatWater = T_C => Math.pow(10, 8.07131 - 1730.63 / (233.426 + T_C)) / 750.06;
  // vapour pressure over ice (Magnus form), Pa – frost point of dried gas (ISO 14687 water content)
  H2.pIce = T_C => 611.2 * Math.exp(22.46 * T_C / (272.62 + T_C));
  // density of dry air at sea level, kg/m³ (wind power correction, IEC 61400-12-1)
  H2.airDensity = T_C => 101325 / (287.05 * K(T_C));

  /* ---------------- Thermodynamics (CM ch. 3) ------------------------ */
  // (3.5) LeRoy correlation, liquid water, T in K
  H2.ErevT = T_K => 1.5184 - 1.5421e-3 * T_K + 9.523e-5 * T_K * Math.log(T_K) + 9.84e-8 * T_K * T_K;
  // steam feed (SOEC): linear fit to NIST-JANAF dG_f and dH_f of H2O(g)
  H2.ErevSteam = T_K => (228.6e3 - 51.87 * (T_K - 298.15)) / (2 * C.F);
  H2.EtnSteam = T_K => (241.8e3 + 8.6 * (T_K - 298.15)) / (2 * C.F);
  // (3.6) Nernst
  H2.nernst = (E0, T_K, pH2, pO2, aH2O) => E0 + C.R * T_K / (2 * C.F) * Math.log(pH2 * Math.sqrt(pO2) / aH2O);

  /* ---------------- Kinetics (CM ch. 4) ------------------------------ */
  H2.etaAct = (j, j0, alpha, T_K) => C.R * T_K / (alpha * C.F) * Math.asinh(j / (2 * j0));   // (4.5)
  H2.tafel = (j, j0, alpha, T_K) => 2.303 * C.R * T_K / (alpha * C.F) * Math.log10(j / j0);   // (4.6)
  H2.nafionSigma = (lambda, T_K) => (0.005139 * lambda - 0.00326) * Math.exp(1268 * (1 / 303 - 1 / T_K)); // (4.8)
  H2.etaConc = (j, jlim, T_K, n) => (j >= jlim ? 1 : -C.R * T_K / ((n || 2) * C.F) * Math.log(1 - j / jlim)); // (4.10)

  /* ---------------- Technology presets (CM Table 4.2/4.3/5.1) -------- */
  // Durability (Hasim 2.1): PEM and alkaline degradation and stack life at the US DOE status (technical targets, 2022 status:
  // PEM 4.8 mV/1000 h and 40 000 h, alkaline 3.2 mV/1000 h and 60 000 h, end of life at +10 % voltage); SOEC 7 mV/1000 h, between
  // the DOE status (6.4) and 20 000 h stack tests (7.4 mV/1000 h, Schefold et al. 2017). stackLife_h caps the life (DOE 2026 targets).
  // AEM: cell resistance for current commercial units (Enapter 4.8 kWh/Nm³ system). PEM: pPart = lowest cathode pressure at part
  // load – below the purity limit the pressure is lowered so that hydrogen in oxygen stays at the trip level (Scheepers et al. 2020).
  // Temperature (Hasim 2.2): j0a, j0c and ASR are the values at Tref_C (the preset temperature); at another operating temperature
  // they follow Arrhenius factors with the activation energies Ea_act (electrode kinetics) and Ea_ohm (membrane/electrolyte
  // conduction, kJ/mol): Nafion ≈ 10.5 (CM 4.8), 30 % KOH ≈ 12, YSZ ≈ 80; electrode kinetics ≈ 50 (low temperature) and ≈ 110 (SOEC).
  // Calibrated against the Bender et al. 2019 round robin (60/80 °C) and the Massari et al. 2026 stack (55–80 °C), see the
  // Validation Note; the values at the preset temperature are unchanged.
  // Crossover (Hasim 2.3, CM 7.6): three contributions to the hydrogen flux into the anode gas, calibrated on the direct PEM/alkaline
  // comparison of Trinke et al. 2018 (J. Electrochem. Soc. 165, F502; Nafion 117 and Zirfon at 60 °C, 1–20 bar) and the 500 kW stack of
  // Massari et al. 2026 – both in the calibration set of the pre-registered benchmark:
  //  · saturated diffusion Ψ·p_H2/δ (Ψ of Nafion 117 confirmed within 3 % by the zero-current measurements; Zirfon in 32 wt-% KOH:
  //    2.0e-12, fitted together with κ to the separated-cycle measurements at 1–20 bar, close to the literature diffusion value),
  //  · supersaturation κ·j/δ (dissolved hydrogen above the Henry value at the cathode; proportional to the current density, pressure-
  //    independent; κ = 3.3e-10 for the PEM cell of Trinke et al., 1.5e-11 for the Zirfon cell, 4e-11 for an AEM cell with liquid KOH feed),
  //  · electrolyte mixing φ·S_H2·p_H2·V̇/A for alkaline stacks with mixed lye cycles: the lye leaving the cathode compartment is saturated
  //    with hydrogen at the system pressure and releases it in the anode compartment; V̇/A is the lye circulation per cell area
  //    (lye_Lmin_m2, L min⁻¹ m⁻²; 2.2 for the preset – set so that the 500 kW stack's 1.5–1.6 vol-% at 13 % load and 30 bar is reproduced),
  //    φ = 1.3 the carry-over factor fitted to the mixed-cycle measurements. mixedLye = false models separated cycles; lyeAdapt = true
  //    reduces the circulation in proportion to the load down to the fraction lyeMin (Brauns & Turek 2022 operating concept).
  H2.LYE = { S_H2: 3.6e-5, carry: 1.3 };   // S_H2: H2 solubility in 32 wt-% KOH, mol L⁻¹ bar⁻¹ (3.6e-7 mol Pa⁻¹ m⁻³, Ruetschi & Amlie 1966)
  H2.TECH = {
    PEM:  { name: 'PEM',  T_C: 80, Tref_C: 80, Ea_act: 50, Ea_ohm: 10.5, j0a: 2e-7, j0c: 1e-2, alpha: 1.5, ASR: 0.12, jlim: 4.0, jnom: 1.8, pH2: 30, pO2: 1,  aH2O: 1, steam: false, pPart: 10,
            degr_uVh: 4.8, stackLife_h: 80000, minLoad: 0.10, cost_EURkW: 1500, Acell: 1500, cells: 150, Psi: 2e-11, kappa: 3.3e-10, delta_cm: 0.0183, lye_Lmin_m2: 0, SEC_sys: 55 },
    AEL:  { name: 'Alkaline', T_C: 80, Tref_C: 80, Ea_act: 50, Ea_ohm: 12, j0a: 1e-6, j0c: 5e-3, alpha: 1.0, ASR: 0.18, jlim: 2.0, jnom: 0.4, pH2: 30, pO2: 30, aH2O: 1, steam: false,
            degr_uVh: 3.2, stackLife_h: 80000, minLoad: 0.20, cost_EURkW: 1000, Acell: 26000, cells: 230, Psi: 2.0e-12, kappa: 1.5e-11, delta_cm: 0.05, mixedLye: true, lye_Lmin_m2: 2.2, lyeAdapt: false, lyeMin: 0.3, SEC_sys: 52 },
    AEM:  { name: 'AEM',  T_C: 60, Tref_C: 60, Ea_act: 50, Ea_ohm: 12, j0a: 5e-7, j0c: 1e-3, alpha: 1.2, ASR: 0.12, jlim: 2.5, jnom: 1.0, pH2: 10, pO2: 1,  aH2O: 1, steam: false,
            degr_uVh: 20, stackLife_h: 20000, minLoad: 0.10, cost_EURkW: 1150, Acell: 1000, cells: 100, Psi: 3e-12, kappa: 4e-11, delta_cm: 0.005, lye_Lmin_m2: 0, SEC_sys: 54 },
    SOEC: { name: 'SOEC', T_C: 800, Tref_C: 800, Ea_act: 110, Ea_ohm: 80, j0a: 0.5, j0c: 0.5, alpha: 1.0, ASR: 0.25, jlim: 2.0, jnom: 0.8, pH2: 1, pO2: 1, aH2O: 1, steam: true,
            degr_uVh: 7, stackLife_h: 30000, minLoad: 0.30, cost_EURkW: 2200, Acell: 100, cells: 60, Psi: 0, kappa: 0, delta_cm: 0.001, lye_Lmin_m2: 0, SEC_sys: 40 }
  };
  /* Hydrogen crossover into the anode gas, mol/(cm² s) (CM 7.6, Hasim 2.3): saturated diffusion + supersaturation + lye mixing */
  H2.crossover = function (tp, j) {
    const p = tp.pH2 || 1, d = tp.delta_cm || 1, jj = Math.max(0, j || 0);
    const diff = (tp.Psi || 0) * p / d;
    const ss = (tp.kappa || 0) * jj / d;
    let mix = 0;
    if (tp.mixedLye !== false && tp.lye_Lmin_m2 > 0) {                                  // 0 = separated cycles or no liquid electrolyte
      let V = tp.lye_Lmin_m2;                                                         // L/(min m²)
      if (tp.lyeAdapt && tp.jnom > 0) V *= Math.max(tp.lyeMin != null ? tp.lyeMin : 0.3, Math.min(1, jj / tp.jnom));
      mix = H2.LYE.carry * H2.LYE.S_H2 * p * V / 6e5;                                  // L/(min m²) → L/(s cm²)
    }
    return { nx: diff + ss + mix, diff, ss, mix };
  };

  /* Cell model (CM 4.4): Ecell = Erev + eta_a + eta_c + j ASR + eta_conc */
  H2.cell = function (tp, j) {
    const T = K(tp.T_C);
    const E0 = tp.steam ? H2.ErevSteam(T) : H2.ErevT(T);
    const Erev = H2.nernst(E0, T, tp.pH2, tp.pO2, tp.aH2O || 1);
    const Etn = tp.steam ? H2.EtnSteam(T) : C.Etn25;
    // temperature factors of the kinetic and ohmic parameters relative to their reference temperature (Hasim 2.2; CM 4.5/4.8)
    const Tr = K(tp.Tref_C != null ? tp.Tref_C : tp.T_C), dT = 1 / T - 1 / Tr;
    const fA = tp.Ea_act ? Math.exp(-tp.Ea_act * 1000 / C.R * dT) : 1, fO = tp.Ea_ohm ? Math.exp(tp.Ea_ohm * 1000 / C.R * dT) : 1;
    const ea = H2.etaAct(j, tp.j0a * fA, tp.alpha, T);
    const ec = H2.etaAct(j, tp.j0c * fA, tp.alpha, T);
    const eo = j * tp.ASR * fO;
    const en = tp.jlim ? H2.etaConc(Math.min(j, tp.jlim * 0.999), tp.jlim, T, 2) : 0;
    const E = Erev + ea + ec + eo + en;
    // crossover and Faradaic efficiency (CM 7.6/7.7): diffusion ∝ p_H2, supersaturation ∝ j, lye mixing (Hasim 2.3)
    const cx = H2.crossover(tp, j), nx = cx.nx;
    const jx = 2 * C.F * nx;
    const etaF = j > 0 ? Math.max(0, 1 - jx / j) : 0;
    const xH2O2 = j > 0 ? nx / (nx + j / (4 * C.F)) : (nx > 0 ? 1 : 0);
    return { j, T_K: T, E0, Erev, Etn, eta_a: ea, eta_c: ec, eta_ohm: eo, eta_conc: en, Ecell: E,
      etaF, jcross: jx, xH2inO2: xH2O2, nx, cross: cx,
      SEC_stack: C.kSEC * E / Math.max(etaF, 1e-6),
      eff_HHV: C.Etn25 / E, eff_LHV: C.E_LHV / E, q_heat_kWhkg: C.kSEC * (E - Etn) };
  };
  H2.polarization = function (tp, jmax, n) {
    n = n || 60; jmax = jmax || tp.jlim * 0.95;
    const out = [];
    for (let i = 1; i <= n; i++) out.push(H2.cell(tp, jmax * i / n));
    return out;
  };

  /* Stack life and degradation (CM 6.6): the stack is replaced at the stated life or when the cell voltage
     has risen by f_EoL (10 %), whichever comes first; the life-average voltage rise is half of the rise at
     replacement.  One definition for the dispatch, the design chain and the impact assessment. */
  H2.stackLife = function (tp, E0, fEoL) {
    E0 = E0 || H2.cell(tp, tp.jnom).Ecell; fEoL = fEoL == null ? 0.1 : fEoL;
    const rd = Math.max(0, tp.degr_uVh || 0) * 1e-6;                          // V/h
    const tEoL = rd > 0 ? fEoL * E0 / rd : Infinity;                          // CM 6.6
    const life = tp.stackLife_h > 0 ? tp.stackLife_h : Infinity;
    const tRep = Math.min(life, tEoL), ok = isFinite(tRep);
    const rise = ok ? rd * tRep / E0 : 0;                                      // voltage rise at replacement, fraction of E0
    return { E0, tEoL, tRep: ok ? tRep : 1e9, rise, degr_frac: rise / 2, limitedBy: tEoL < life ? 'degradation' : 'stack life' };
  };
  /* Current density at which hydrogen in oxygen equals x_trip (CM 7.7). x(j) = ṅ_x(j)/(ṅ_x(j) + j/4F) falls monotonically with j
     because the load-independent part of the flux (diffusion, lye mixing) is diluted by the growing oxygen flow; the load-proportional
     part (supersaturation, adapted lye flow) only sets a floor. Solved by bisection between 0 and j_nom; 0 if the floor alone stays
     below the limit at every load, Infinity if the limit is not met even at j_nom. */
  H2.jTrip = function (tp, xTrip) {
    xTrip = xTrip || 0.02;
    const x = j => { const n = H2.crossover(tp, j).nx; return n / (n + j / (4 * C.F)); };
    if (!(H2.crossover(tp, tp.jnom).nx > 0)) return 0;
    if (x(tp.jnom) > xTrip) return Infinity;
    if (x(1e-9 * tp.jnom) <= xTrip) return 0;
    let lo = 1e-9 * tp.jnom, hi = tp.jnom;
    for (let i = 0; i < 80; i++) { const m = 0.5 * (lo + hi); if (x(m) > xTrip) lo = m; else hi = m; }
    return 0.5 * (lo + hi);
  };
  /* Lowest DC load fraction at which hydrogen in oxygen stays at the trip level x_trip (CM 7.6/7.7 solved for j) */
  H2.purityMinLoad = function (tp, xTrip) {
    const jmin = H2.jTrip(tp, xTrip);
    if (!(jmin > 0)) return 0;
    if (jmin >= tp.jnom) return 1;
    return Math.min(1, jmin * H2.cell(tp, jmin).Ecell / (tp.jnom * H2.cell(tp, tp.jnom).Ecell));
  };
  /* Part-load pressure (Hasim 2.1): a differential-pressure stack with pPart < pH2 lowers its cathode pressure below the purity
     limit L_nom, in proportion to the load, so that hydrogen in oxygen stays at the trip level (permeation ∝ pressure, CM 7.6),
     down to pPart; the purity limit of the minimum load is then the one at pPart.  null = constant pressure. */
  H2.partPressure = function (tp, xTrip) {
    if (!tp || tp.steam || !(tp.pPart > 0) || !(tp.pPart < (tp.pH2 || 1))) return null;
    const Lnom = H2.purityMinLoad(tp, xTrip);
    if (!(Lnom > 0 && Lnom < 1)) return null;
    const Lmin = H2.purityMinLoad(Object.assign({}, tp, { pH2: tp.pPart }), xTrip);
    return { Lnom, Lmin, pNom: tp.pH2, pPart: tp.pPart, p: L => (L >= Lnom ? tp.pH2 : Math.max(tp.pPart, tp.pH2 * L / Lnom)) };
  };
  /* Gas processing losses (CM 8.4, DM 10): O₂ before the deoxo (mole fraction) consumes 2·y_O₂ of the hydrogen,
     the TSA dryer loses 1 % as regeneration purge */
  H2.gasProcessing = function (tech) { const yO2 = tech === 'PEM' ? 0.001 : 0.002, tsa = 0.01; return { yO2, tsa, loss: 1 - (1 - 2 * yO2) * (1 - tsa) }; };

  /* Stack/system model (CM 6.1, 6.4, 7.8) -------------------------------- */
  // SOEC (steam feed): below the thermoneutral voltage the stack needs k_SEC·(E_tn − E) of heat per kg (CM 3.12),
  // and raising the steam needs q_steam ≈ 8.94 kg × 2.67 MJ/kg ≈ 6.6 kWh per kg H₂. Both are supplied by electric
  // heaters (η 0.98) unless soecHeat = 'external', when the steam comes from external heat (Q_ext).
  H2.system = function (tp, P_rated_kW, opts) {
    opts = Object.assign({ eta_rect: 0.97, eta_trafo: 0.99, P_BoP_fixed_frac: 0.02, k_BoP: 0.04, degr_frac: 0, soecHeat: 'electric', q_steam: 6.6, eta_heater: 0.98, partPressure: true, xTrip: 0.02 }, opts || {});
    const cnom = H2.cell(tp, tp.jnom);
    const pp = opts.partPressure ? H2.partPressure(tp, opts.xTrip) : null;     // cathode pressure lowered at part load (PEM)
    // total active area so that rated DC stack power at jnom equals P_rated
    const Atot = P_rated_kW * 1000 / (tp.jnom * cnom.Ecell); // cm2
    const dE = opts.degr_frac * cnom.Ecell;
    function atLoad(L) {
      // L = DC power fraction; solve j so that j*E(j)*Atot = L*P
      const target = L * P_rated_kW * 1000 / Atot;
      const pL = pp ? pp.p(L) : tp.pH2, tpL = pp && pL < tp.pH2 ? Object.assign({}, tp, { pH2: pL }) : tp;
      let lo = 1e-5, hi = tp.jlim * 0.999;
      for (let k = 0; k < 60; k++) {
        const mid = 0.5 * (lo + hi);
        const pm = mid * (H2.cell(tpL, mid).Ecell + dE);
        if (pm > target) hi = mid; else lo = mid;
      }
      const c = H2.cell(tpL, lo);
      const E = c.Ecell + dE;
      const I = lo * Atot;
      const mdot = c.etaF * C.M_H2 * I / (2 * C.F) * 3600; // kg/h
      const PDC = L * P_rated_kW;
      let Pheat = 0, Qext = 0;
      if (tp.steam) {
        const qEndo = C.kSEC * Math.max(0, c.Etn - E);            // kWh/kg, heat demand below thermoneutral
        const ext = opts.soecHeat === 'external';
        Pheat = mdot * (qEndo + (ext ? 0 : opts.q_steam)) / opts.eta_heater;
        Qext = ext ? mdot * opts.q_steam : 0;
      }
      const PAC = PDC / (opts.eta_rect * opts.eta_trafo) + opts.P_BoP_fixed_frac * P_rated_kW + opts.k_BoP * PDC + Pheat;
      return { L, j: lo, Ecell: E, etaF: c.etaF, mdot_kgh: mdot, P_DC_kW: PDC, P_AC_kW: PAC, P_heat_kW: Pheat, Q_ext_kW: Qext,
        SEC_stack: C.kSEC * E / c.etaF, SEC_sys: PAC / Math.max(mdot, 1e-9), xH2inO2: c.xH2inO2, pH2: pL };
    }
    return { Atot_cm2: Atot, nominal: atLoad(1), atLoad, partPressure: pp };
  };
  /* Lookup table of the system curve for fast hourly simulation */
  H2.systemTable = function (tp, P_rated_kW, opts, n) {
    const sys = H2.system(tp, P_rated_kW, opts); n = n || 50;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const L = Math.max(0.005, i / n);
      const r = sys.atLoad(L);
      pts.push({ PAC: r.P_AC_kW, mdot: r.mdot_kgh, PDC: r.P_DC_kW, L, Qext: r.Q_ext_kW || 0, Pheat: r.P_heat_kW || 0, p: r.pH2 });
    }
    const interp = (P, key) => {
      if (P <= 0) return 0;
      if (P <= pts[0].PAC) return pts[0][key] * P / pts[0].PAC;
      for (let i = 1; i < pts.length; i++) if (P <= pts[i].PAC) { const a = pts[i - 1], b = pts[i], f = (P - a.PAC) / (b.PAC - a.PAC); return a[key] + f * (b[key] - a[key]); }
      return pts[pts.length - 1][key];
    };
    return { sys, pts, dcFromAC: P => interp(P, 'PDC'), qextFromAC: P => interp(P, 'Qext'), heatFromAC: P => interp(P, 'Pheat'),
      pFromAC: P => (P <= pts[0].PAC ? pts[0].p : interp(P, 'p')),                   // cathode pressure (bar) at an AC power
      // hydrogen from AC power (kW) by linear interpolation
      h2FromAC(P) {
        if (P <= pts[0].PAC) return pts[0].mdot * P / pts[0].PAC;
        for (let i = 1; i < pts.length; i++) if (P <= pts[i].PAC) {
          const a = pts[i - 1], b = pts[i], f = (P - a.PAC) / (b.PAC - a.PAC);
          return a.mdot + f * (b.mdot - a.mdot);
        }
        return pts[pts.length - 1].mdot;
      },
      PACmax: pts[pts.length - 1].PAC };
  };

  /* ---------------- Compression (CM ch. 10 / DM ch. 12) ------------- */
  H2.COMP_MAX_STAGES = 30;
  H2.compress = function (p1, p2, T1_C, o) {
    o = Object.assign({ N: 0, rmax: 2.3, eta_s: 0.75, eta_mech: 0.95, eta_motor: 0.95, Zm: null, mdot_kgh: 0 }, o || {});
    if (!(p1 > 0 && p2 > 0 && isFinite(p1) && isFinite(p2))) throw new RangeError('Compression needs positive, finite suction and discharge pressures.');
    if (!(o.N > 0) && !(o.rmax > 1)) throw new RangeError('The pressure ratio per stage (r_max) must be greater than 1.');
    if (!(o.eta_s > 0 && o.eta_s <= 1)) throw new RangeError('The isentropic efficiency must lie between 0 and 1.');
    const T1 = K(T1_C), ex = (C.gamma - 1) / C.gamma;
    if (p2 <= p1) return { N: 0, r: 1, w_iso_kWhkg: 0, w_ideal_kWhkg: 0, SEC_kWhkg: 0, T2_K: T1, T2_C: T1_C, P_kW: 0, Q_cool_kW: 0, bypass: true };
    const N = o.N > 0 ? Math.round(o.N) : Math.max(1, Math.ceil(Math.log(p2 / p1) / Math.log(o.rmax) - 1e-9));
    if (N > H2.COMP_MAX_STAGES) throw new RangeError('More than ' + H2.COMP_MAX_STAGES + ' compression stages would be needed – raise the ratio per stage or lower the discharge pressure.');
    const r = Math.pow(p2 / p1, 1 / N);
    let ws = 0;
    for (let i = 0; i < N; i++) {
      const pin = p1 * Math.pow(r, i), pout = pin * r;
      const Zi = o.Zm || (H2.Z(pin, T1) + H2.Z(pout, T1)) / 2;
      ws += Zi * C.gamma / (C.gamma - 1) * C.Rs * T1 * (Math.pow(r, ex) - 1);
    }
    const Zm = o.Zm || (H2.Z(p1, T1) + H2.Z(p2, T1)) / 2;
    const wiso = Zm * C.Rs * T1 * Math.log(p2 / p1);
    const T2 = T1 + T1 * (Math.pow(r, ex) - 1) / o.eta_s;
    const eta = o.eta_s * o.eta_mech * o.eta_motor;
    const SEC = ws / eta / 3.6e6;
    const P_kW = o.mdot_kgh * SEC;
    return { N, r, w_iso_kWhkg: wiso / 3.6e6, w_ideal_kWhkg: ws / 3.6e6, SEC_kWhkg: SEC, T2_K: T2, T2_C: T2 - 273.15, P_kW, Q_cool_kW: 0.9 * P_kW };
  };
  /* Largest stage ratio that keeps the discharge temperature at T_lim (API 618: 120 °C for hydrogen-rich gas
     or non-lubricated cylinders, 6th ed. 2024): T₂ = T₁ + T₁(r^((γ−1)/γ) − 1)/η_s ≤ T_lim */
  H2.rmaxForT = (T1_C, Tlim_C, eta_s) => Math.pow(1 + (eta_s || 0.75) * Math.max(0, Tlim_C - T1_C) / K(T1_C), C.gamma / (C.gamma - 1));
  // compressor suction (intercooler outlet) and gas-cooler outlet with air cooling: 10 K approach to the design ambient, at least 40 °C
  H2.coolOutlet = Tamb => Math.max(40, (Tamb == null ? 25 : Tamb) + 10);
  H2.COMP_ETA = { s: 0.75, mech: 0.95, motor: 0.95 };           // one set of compressor efficiencies for all models (CM 10.5)

  /* ---------------- Economics (CM ch. 17 / DM ch. 20) --------------- */
  H2.CRF = (r, n) => (r === 0 ? 1 / n : r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));

  /* ---------------- Random numbers & synthetic weather --------------- */
  H2.rng = function (seed) {
    let s = (seed >>> 0) || 1;
    const u = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return (s + 0.5) / 4294967296; };
    const n = () => { const a = u(), b = u(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); };
    return { u, n };
  };
  function lgamma(x) { // Lanczos
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1; let a = c[0]; const t = x + g + 0.5;
    for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  H2.gamma = x => Math.exp(lgamma(x));
  function normCdf(x) { // Abramowitz-Stegun
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  }
  H2.normCdf = normCdf;

  /* Generic wind-turbine power curve, per-unit of rated power */
  H2.turbinePU = function (v, o) {
    o = o || {}; const vi = o.v_in || 3, vr = o.v_rated || 12, vo = o.v_out || 25;
    if (v < vi || v >= vo) return 0;
    if (v >= vr) return 1;
    return (v * v * v - vi * vi * vi) / (vr * vr * vr - vi * vi * vi);
  };

  /* Synthetic typical year (8760 h): GHI, ambient temperature, wind speed.
     Solar geometry + Markov clearness index, scaled to the annual GHI;
     wind = AR(1) Gaussian process with diurnal/seasonal modulation, whose values are then mapped by rank onto the
     Weibull(k, c) distribution of the site (Hasim 2.1): the hours keep their order – persistence, daily and seasonal
     pattern – while the mean wind speed and the shape factor k are exactly those of the site.  (In place of TMY data, cf. DM 4.3)
     The year is deterministic for its options, so H2.weather keeps the last few years in a cache (Hasim 3.0): a solve that
     changes only sizes or costs reuses the site's year, which is most of the solver's time.  Callers never modify the arrays. */
  const WEATHER_DEFAULTS = { lat: 29, GHI_annual: 2200, v_mean: 8.6, k: 2.0, T_mean: 25, T_seas: 8, T_diur: 6,
    windDiurnal: 0.15, windSeasonal: 0.12, seed: 1, cloudiness: 0.25 };
  const memo = { years: new Map(), poa: new WeakMap(), hits: 0, misses: 0, max: 12 };
  const memoKey = o => { const k = Object.keys(o).sort(); return k.map(x => x + '=' + (typeof o[x] === 'number' || typeof o[x] === 'string' || typeof o[x] === 'boolean' ? String(o[x]) : JSON.stringify(o[x]))).join('|'); };
  const trim = () => { while (memo.years.size > memo.max) memo.years.delete(memo.years.keys().next().value); };
  H2.cache = {
    clear: () => { memo.years.clear(); memo.poa = new WeakMap(); memo.hits = memo.misses = 0; },
    stats: () => ({ years: memo.years.size, hits: memo.hits, misses: memo.misses }),
    limit: n => { memo.max = Math.max(1, n | 0); trim(); }
  };
  H2.weather = function (o) {
    o = Object.assign({}, WEATHER_DEFAULTS, o || {});
    if (o.nocache) { delete o.nocache; return o.data ? measuredYear(o) : weatherYear(o); }
    const key = o.data ? 'data|' + (o.data.id || H2.seriesHash(o.data.ghi) + H2.seriesHash(o.data.ws) + H2.seriesHash(o.data.tam)) + '|' + o.lat : memoKey(o);
    let W = memo.years.get(key);
    if (W) { memo.hits++; memo.years.delete(key); memo.years.set(key, W); return W; }   // most recent at the end
    memo.misses++; W = o.data ? measuredYear(o) : weatherYear(o); Object.freeze(W);
    memo.years.set(key, W); trim();
    return W;
  };
  /* FNV-1a hash (8 hex digits) of a series – the identity of measured data in the weather cache and in project files */
  H2.seriesHash = function (a) {
    let h = 0x811c9dc5 >>> 0; const mix = c => { h = Math.imul(h ^ c, 16777619) >>> 0; };
    if (typeof a === 'string') { for (let i = 0; i < a.length; i++) mix(a.charCodeAt(i)); }
    else { const f = new Float64Array(1), u = new Uint32Array(f.buffer); mix(a.length); for (let i = 0; i < a.length; i++) { const v = a[i]; if (typeof v === 'number') { f[0] = v; mix(u[0]); mix(u[1]); } else { const s = String(v); for (let j = 0; j < s.length; j++) mix(s.charCodeAt(j)); } } }
    return ('0000000' + h.toString(16)).slice(-8);
  };
  /* a measured or typical year (engine-site.js): o.data = { ghi, tam, ws, dni?, dhi? } with 8760 hourly values in local
     solar time; the arrays are copied, so a project file or a script can hold plain arrays */
  function measuredYear(o) {
    const D = o.data, n = 8760, take = a => { const f = new Float64Array(n); for (let i = 0; i < n; i++) f[i] = +a[i]; return f; };
    if (!D || !D.ghi || D.ghi.length !== n || !D.tam || D.tam.length !== n || !D.ws || D.ws.length !== n) throw new RangeError('measured weather needs ghi, tam and ws with 8760 values each');
    const ghi = take(D.ghi), tam = take(D.tam), ws = take(D.ws), cosz = new Float64Array(n), phi = o.lat * Math.PI / 180;
    for (let h = 0; h < n; h++) { const d = Math.floor(h / 24) + 1, hr = h % 24 + 0.5, decl = 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + d) / 365), w = (hr - 12) * 15 * Math.PI / 180; cosz[h] = Math.max(0, Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(w)); }
    let m = 0, s2 = 0; for (let h = 0; h < n; h++) m += ws[h]; m /= n; for (let h = 0; h < n; h++) s2 += (ws[h] - m) * (ws[h] - m);
    const k = m > 0 ? Math.pow(Math.sqrt(s2 / (n - 1)) / m, -1.086) : 2;        // Justus (1978) moment estimate, Eq. 4.2 of Muhsen (2026)
    return { ghi, tam, ws, cosz, opts: o, weibull_c: m / H2.gamma(1 + 1 / k), weibull_k: k, measured: true, dni: D.dni && D.dni.length === n ? take(D.dni) : null, dhi: D.dhi && D.dhi.length === n ? take(D.dhi) : null };
  }
  function weatherYear(o) {
    const R = H2.rng(o.seed), n = 8760;
    const ghi = new Float64Array(n), tam = new Float64Array(n), ws = new Float64Array(n), cosz = new Float64Array(n);
    const phi = o.lat * Math.PI / 180;
    let kt = 0.7, cloudState = 0;
    for (let h = 0; h < n; h++) {
      const d = Math.floor(h / 24) + 1, hr = h % 24 + 0.5;
      const decl = 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + d) / 365);
      const w = (hr - 12) * 15 * Math.PI / 180;
      const cz = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(w);
      cosz[h] = Math.max(0, cz);
      if (hr === 0.5) { // daily weather state (Markov)
        const pc = o.cloudiness * (1 + 0.5 * Math.cos(2 * Math.PI * (d - 15) / 365) * Math.sign(o.lat));
        cloudState = R.u() < (cloudState ? 0.55 : pc) ? 1 : 0;
      }
      const target = cloudState ? 0.35 + 0.15 * R.u() : 0.74 - 0.05 * R.u();
      kt = 0.75 * kt + 0.25 * target + 0.03 * R.n();
      kt = Math.min(0.82, Math.max(0.05, kt));
      const G0 = 1361 * (1 + 0.033 * Math.cos(2 * Math.PI * d / 365)) * cosz[h];
      ghi[h] = G0 * kt;
      tam[h] = o.T_mean - o.T_seas * Math.cos(2 * Math.PI * (d - 15) / 365) * Math.sign(o.lat || 1) - o.T_diur * Math.cos(2 * Math.PI * (hr - 3) / 24);
    }
    // scale to annual GHI
    let sum = 0; for (let h = 0; h < n; h++) sum += ghi[h];
    const f = o.GHI_annual * 1000 / sum;
    for (let h = 0; h < n; h++) ghi[h] *= f;
    // wind
    const c = o.v_mean / H2.gamma(1 + 1 / o.k);
    let x = 0; const phiAR = 0.97;
    for (let h = 0; h < n; h++) {
      const d = Math.floor(h / 24), hr = h % 24;
      x = phiAR * x + Math.sqrt(1 - phiAR * phiAR) * R.n();
      const u = Math.min(0.99999, Math.max(1e-6, normCdf(x)));
      const v = c * Math.pow(-Math.log(1 - u), 1 / o.k);
      const mod = 1 + o.windDiurnal * Math.cos(2 * Math.PI * (hr - 2) / 24) + o.windSeasonal * Math.cos(2 * Math.PI * (d - 15) / 365);
      ws[h] = Math.max(0, v * mod);
    }
    if (o.exactWeibull !== false) {           // rank mapping onto the site distribution (the modulation would lower k by about 0.2)
      const idx = new Uint32Array(n); for (let h = 0; h < n; h++) idx[h] = h;
      const sorted = Array.from(idx).sort((a, b) => ws[a] - ws[b]);
      for (let r = 0; r < n; r++) ws[sorted[r]] = c * Math.pow(-Math.log(1 - (r + 0.5) / n), 1 / o.k);
    }
    return { ghi, tam, ws, cosz, opts: o, weibull_c: c };
  }

  /* PV power (CM 14.1, DM 3.3) per kWp DC -> kW AC */
  H2.pvPower = function (G_poa, Tamb, o) {
    o = o || {};
    const gammaT = o.gammaT == null ? -0.0035 : o.gammaT, NOCT = o.NOCT || 45;
    const Tcell = Tamb + (NOCT - 20) / 800 * G_poa;
    const pdc = G_poa / 1000 * (1 + gammaT * (Tcell - 25)) * (1 - (o.losses == null ? 0.10 : o.losses));
    const pac = pdc * (o.eta_inv || 0.98);
    return Math.max(0, Math.min(pac, 1 / (o.dcac || 1.25)));
  };

  /* Plane-of-array irradiance (DM 3.2) from the hourly GHI: Erbs diffuse fraction, isotropic sky diffuse and
     ground reflection (albedo 0.2); an equator-facing fixed tilt for gains below 1.18, otherwise a horizontal
     north–south single-axis tracker limited to ±60°.  The profile is scaled so that the annual sum equals
     gain × annual GHI, i.e. the "tracking gain" keeps its meaning while the daily shape becomes physical.
     Cached per weather year (same site, latitude, gain and albedo → the same profile); callers never modify it. */
  H2.poa = function (W, lat, gain, o) {
    o = o || {}; gain = gain > 0 ? gain : 1;
    const key = lat + '|' + gain + '|' + (o.albedo == null ? 0.2 : o.albedo);
    let m = memo.poa.get(W);
    if (m && m.has(key)) { memo.hits++; return m.get(key); }
    memo.misses++;
    const out = poaProfile(W, lat, gain, o);
    if (!m) { m = new Map(); memo.poa.set(W, m); }
    m.set(key, out);
    return out;
  };
  function poaProfile(W, lat, gain, o) {
    const n = W.ghi.length, out = new Float64Array(n), alb = o.albedo == null ? 0.2 : o.albedo;
    const phi = lat * Math.PI / 180, track = gain >= 1.18, rlim = 60 * Math.PI / 180, south = lat >= 0 ? 1 : -1;
    const beta = Math.min(45, Math.max(5, 0.76 * Math.abs(lat) + 3.1)) * Math.PI / 180;
    const mDNI = W.dni || null, mDHI = W.dhi || null;         // measured components (engine-site.js) replace the Erbs split where present
    let sG = 0, sP = 0;
    for (let h = 0; h < n; h++) {
      const G = W.ghi[h]; if (!(G > 0)) continue; sG += G;
      const d = Math.floor(h / 24) + 1, hr = h % 24 + 0.5;
      const dec = 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + d) / 365), w = (hr - 12) * 15 * Math.PI / 180;
      const up = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(w);
      const east = -Math.cos(dec) * Math.sin(w), north = Math.cos(phi) * Math.sin(dec) - Math.sin(phi) * Math.cos(dec) * Math.cos(w);
      const G0 = 1361 * (1 + 0.033 * Math.cos(2 * Math.PI * d / 365)) * Math.max(up, 0);
      const kt = G0 > 0 ? Math.min(1, G / G0) : 1;
      const kd = kt <= 0.22 ? 1 - 0.09 * kt : kt <= 0.8 ? 0.9511 - 0.1604 * kt + 4.388 * kt * kt - 16.638 * kt * kt * kt + 12.336 * kt * kt * kt * kt : 0.165;
      let Dh, DNI;
      if (mDNI && mDHI && mDNI[h] >= 0 && mDHI[h] >= 0 && mDNI[h] + mDHI[h] > 0) { Dh = Math.min(G, mDHI[h]); DNI = up > 0.05 ? Math.min(mDNI[h], 1100, (G - Dh) / up * 1.05) : 0; }
      else { Dh = Math.min(G, Math.max(0, kd) * G); DNI = up > 0.05 ? Math.min((G - Dh) / up, 1100) : 0; }
      let cosT, tilt;
      if (track) { const R = Math.max(-rlim, Math.min(rlim, Math.atan2(east, Math.max(up, 1e-6)))); cosT = Math.sin(R) * east + Math.cos(R) * up; tilt = Math.abs(R); }
      else { cosT = up * Math.cos(beta) - south * north * Math.sin(beta); tilt = beta; }
      const Gp = DNI * Math.max(0, cosT) + Dh * (1 + Math.cos(tilt)) / 2 + G * alb * (1 - Math.cos(tilt)) / 2;
      out[h] = Gp; sP += Gp;
    }
    const f = sP > 0 ? gain * sG / sP : 0;
    for (let h = 0; h < n; h++) out[h] *= f;
    return out;
  }

  /* Available share of the electrolyser capacity in each hour (DM 2.3 as a deterministic profile): every module
     is out of service in six equal blocks per year, the modules staggered in time, so that the time-average
     equals the plant availability.  One module → whole-plant outages; many modules → a small capacity derating. */
  H2.availProfile = function (avail, modules) {
    const n = 8760, a = new Float64Array(n).fill(1), N = Math.max(1, Math.min(500, Math.round(modules || 1)));
    const out = Math.round(Math.max(0, Math.min(0.5, 1 - (avail == null ? 1 : avail))) * n);
    if (out <= 0) return a;
    const blocks = 6, per = n / blocks;
    for (let i = 0; i < N; i++) {
      const off = 200 + i * per / N;
      for (let k = 0; k < blocks; k++) {
        const len = Math.floor(out / blocks) + (k < out % blocks ? 1 : 0), s0 = Math.round(off + k * per);
        for (let t = 0; t < len; t++) a[(s0 + t) % n] -= 1 / N;
      }
    }
    for (let h = 0; h < n; h++) a[h] = Math.max(0, Math.min(1, a[h]));
    return a;
  };

  /* ---------------- Hourly model (DM Fig. 4.2, CM 14.5/14.7, DM 13.1) */
  H2.defaultHourly = function () {
    return {
      name: 'Case B – 100 MW AEL islanded',
      weather: { lat: 29, GHI_annual: 2200, v_mean: 8.6, k: 2.0, T_mean: 26, T_seas: 7, T_diur: 7, seed: 7, cloudiness: 0.12 },
      pv: { P_MWp: 180, tracking: 1.25, losses: 0.12, gammaT: -0.0035, NOCT: 45, dcac: 1.25, eta_inv: 0.98, capex_EURkWp: 550, om_frac: 0.015 },
      wind: { P_MW: 60, hub_m: 100, ref_m: 100, alpha: 0.14, v_in: 3, v_rated: 12, v_out: 25, losses: 0.188, capex_EURkW: 1300, om_frac: 0.025, density: true },
      battery: { P_MW: 30, E_MWh: 60, eta_rt: 0.88, soc_min: 0.1, soc_max: 0.95, capex_EURkWh: 350, om_frac: 0.02, life: 15 },
      grid: { enabled: false, import_MW: 0, price_EURMWh: 80, CI_gkWh: 300, export: false, export_price: 30, mode: 'fill' },
      ely: { tech: 'AEL', P_MW: 100, modules: 20, minLoad: 0.20, standby_frac: null, useCellModel: true, SEC_fixed: 52, eta_rect: 0.97, eta_trafo: 0.99, BoP_fixed_frac: 0.01, k_BoP: 0.03,
        degr_frac: null, capex_EURkW: 1000, om_frac: 0.025, stack_frac: 0.30, availability: 0.95, purif_loss: null, xTrip: 0.02, soecHeat: 'electric' },
      aux: { P_MW: 6 },
      storage: { enabled: true, flex_h: 168, turndown: 0.3, maxup: 1.2, p_max: 100, p_min: 30, T_C: 25, comp_p_in: 29, comp_T1: 40, Tlim: 120, capex_EURkg: 570 },
      water: { w_DI: 10.5, Y: 0.395, e_RO_kWhm3: 4.0, price_EURm3: 1.2, chem_EURm3: 0.09 },
      econ: { WACC: 0.08, life: 25, f_ind: 0.12, f_cont: 0.10, f_own: 0.04, other_capex_MEUR: 60, fixed_opex_MEUR: 5.0, O2_price_EURt: 0, heat_price: 0, ppa_price_EURMWh: 0, replacements: [] },
      env: {}
    };
  };

  H2.hourly = function (cfg) {
    const n = 8760;
    const W = H2.weather(cfg.weather);
    const tp = Object.assign({}, own(H2.TECH, cfg.ely.tech) || H2.TECH.AEL, cfg.ely.tp || {});   // technology preset with component overrides
    const P_ely = cfg.ely.P_MW * 1000;           // kW (AC input at rated incl. BoP approximately)
    const etaRect = cfg.ely.eta_rect || 0.97, etaTr = cfg.ely.eta_trafo == null ? 0.99 : cfg.ely.eta_trafo, etaConv = etaRect * etaTr;
    const kB = cfg.ely.k_BoP || 0, fB = cfg.ely.BoP_fixed_frac || 0;
    const life = H2.stackLife(tp);                                   // CM 6.6: replacement interval and life-average degradation
    const degr = cfg.ely.degr_frac != null ? cfg.ely.degr_frac : life.degr_frac;
    // Electrolyser system curve (AC kW -> kg/h)
    let tab = null;
    const SECfix = cfg.ely.SEC_fixed || tp.SEC_sys;
    // storage compression: stage ratio limited by the discharge-temperature limit (API 618)
    const st = cfg.storage;
    const cT1 = st.comp_T1 == null ? 40 : st.comp_T1, cEs = st.comp_eta_s || H2.COMP_ETA.s;
    const cR = Math.min(st.comp_rmax || 2.3, H2.rmaxForT(cT1, st.Tlim || 120, cEs));
    const hasComp = !!(st.enabled && st.p_max > st.comp_p_in);
    const cOpt = { rmax: cR, eta_s: cEs, eta_mech: H2.COMP_ETA.mech, eta_motor: H2.COMP_ETA.motor };
    const comp = hasComp ? H2.compress(st.comp_p_in, st.p_max, cT1, cOpt) : { SEC_kWhkg: 0, N: 0, T2_C: null };
    // part-load pressure (PEM): only where a compressor raises the hydrogen to the delivery or storage pressure
    const xTrip = cfg.ely.xTrip || 0.02, ppOn = hasComp && cfg.ely.partPressure !== false && !!(cfg.ely.useCellModel && H2.partPressure(tp, xTrip));
    if (cfg.ely.useCellModel) {
      tab = H2.systemTable(tp, P_ely * etaConv / (1 + kB + fB), {
        eta_rect: etaRect, eta_trafo: etaTr, P_BoP_fixed_frac: fB, k_BoP: kB, degr_frac: degr, soecHeat: cfg.ely.soecHeat, partPressure: ppOn, xTrip }, 40);
    }
    const Pmax = tab ? tab.PACmax : P_ely;
    const cap = P => Math.min(P, Pmax);
    const h2At = P => (P <= 0 ? 0 : (tab ? tab.h2FromAC(cap(P)) : P / SECfix));
    const dcAt = P => (P <= 0 ? 0 : (tab ? tab.dcFromAC(cap(P)) : P * etaConv / (1 + kB + fB)));
    const qxAt = P => (P <= 0 || !tab ? 0 : tab.qextFromAC(cap(P)));
    const htAt = P => (P <= 0 || !tab ? 0 : tab.heatFromAC(cap(P)));
    // minimum load: the design value, raised where hydrogen in oxygen would reach the trip level (CM 7.7, DM 10.2) – with the
    // part-load pressure the limit at the lowest cathode pressure
    const Lpur = tp.steam ? 0 : ppOn ? H2.partPressure(tp, xTrip).Lmin : H2.purityMinLoad(tp, xTrip);
    const minPur = Lpur > 0 ? (tab ? tab.sys.atLoad(Math.max(0.005, Lpur)).P_AC_kW / Pmax : Lpur) : 0;
    const minLoad = Math.min(1, Math.max(cfg.ely.minLoad || 0, minPur));
    const sbf = cfg.ely.standby_frac != null ? cfg.ely.standby_frac : (tp.steam ? 0.04 : 0.01);   // hot standby (SOEC kept at temperature)
    const Pstandby = sbf * Pmax;
    const Paux = (cfg.aux.P_MW || 0) * 1000;
    // hydrogen lost in gas processing (deoxo + TSA purge) and the hourly available capacity (plant availability)
    const purif = cfg.ely.purif_loss != null ? cfg.ely.purif_loss : H2.gasProcessing(cfg.ely.tech).loss;
    const availA = H2.availProfile(cfg.ely.availability == null ? 1 : cfg.ely.availability, cfg.ely.modules || 1);
    // compression energy per kg at a lowered suction pressure (part load), cached in 0.5 bar steps
    const cMemo = {}, secAt = pin => { const k = Math.round(pin * 2) / 2; if (!(k in cMemo)) cMemo[k] = H2.compress(Math.max(1.013, k), st.p_max, cT1, cOpt).SEC_kWhkg; return cMemo[k]; };
    let E_compH = 0;

    const pvKW = new Float64Array(n), wdKW = new Float64Array(n), elyKW = new Float64Array(n), h2 = new Float64Array(n), h2s = new Float64Array(n),
      soc = new Float64Array(n), batKW = new Float64Array(n), curt = new Float64Array(n), expKW = new Float64Array(n), gridKW = new Float64Array(n), unmet = new Float64Array(n);
    const bat = cfg.battery, Ebat = (bat.E_MWh || 0) * 1000, Pbat = (bat.P_MW || 0) * 1000, ec = Math.sqrt(bat.eta_rt || 0.9);
    let E = Ebat * 0.5;
    const pvo = cfg.pv, wdo = cfg.wind;
    const poa = (pvo.P_MWp || 0) > 0 ? H2.poa(W, cfg.weather.lat == null ? 29 : cfg.weather.lat, pvo.tracking || 1) : null;
    const shear = Math.pow((wdo.hub_m || 100) / (wdo.ref_m || 100), wdo.alpha == null ? 0.14 : wdo.alpha);
    let starts = 0, running = false, hMin = 0, hRun = 0, hStandby = 0, hOut = 0, batThroughput = 0;
    let E_batloss = 0, E_dc = 0, E_standby = 0, E_qx = 0, E_ht = 0; const E0bat = E;
    const gridOn = cfg.grid.enabled, gridMax = (cfg.grid.import_MW || 0) * 1000, mode0 = cfg.grid.mode, expOn = !!cfg.grid.export;
    const tgtF = cfg.grid.target == null ? 0.6 : cfg.grid.target;
    // hourly series of the grid price and carbon intensity (engine-site.js) and the price-following mode: in an hour whose price
    // is at or below the cap the grid tops the electrolyser up to full load, otherwise it only bridges to the minimum load (fill)
    const priceS = cfg.grid.price_series && cfg.grid.price_series.length === n ? cfg.grid.price_series : null, ciS = cfg.grid.CI_series && cfg.grid.CI_series.length === n ? cfg.grid.CI_series : null;
    const expS = cfg.grid.export_series && cfg.grid.export_series.length === n ? cfg.grid.export_series : null, priceF = cfg.grid.price_EURMWh || 0, pCap = cfg.grid.price_cap == null ? 0 : cfg.grid.price_cap;
    const priceAt = h => (priceS ? priceS[h] : priceF);
    let mode = mode0;
    const auxBackup = (cfg.grid.auxBackup_MW || 0) * 1000;   // emergency supply for auxiliaries only (islanded plants)
    const auxFixed = cfg.aux.fixed_frac == null ? 0.5 : cfg.aux.fixed_frac; let lastLoad = 0.5, E_auxTot = 0;
    for (let h = 0; h < n; h++) {
      const ppv = poa ? (pvo.P_MWp || 0) * 1000 * H2.pvPower(poa[h], W.tam[h], pvo) : 0;
      const vh = W.ws[h] * shear * (wdo.density === false ? 1 : Math.cbrt(H2.airDensity(W.tam[h]) / 1.225));   // air-density corrected wind speed
      const pw = (wdo.P_MW || 0) * 1000 * H2.turbinePU(vh, wdo) * (1 - (wdo.losses || 0));
      pvKW[h] = ppv; wdKW[h] = pw;
      const a = availA[h], PmaxH = a * Pmax, PminH = minLoad * PmaxH, tgt = tgtF * PmaxH, PsbH = a > 0 ? Pstandby : 0;
      const PauxH = Paux * (auxFixed + (1 - auxFixed) * lastLoad);   // fixed part + part following the previous hour's load
      if (mode0 === 'price') mode = priceAt(h) <= pCap ? 'full' : 'fill';
      let avail = ppv + pw - PauxH;      // priority 1: auxiliaries
      let pe = 0, pb = 0, pg = 0, c = 0;
      if (avail < 0) { // auxiliaries not covered: battery / grid
        let need = -avail; avail = 0;
        const dis = Math.min(need, Pbat, Math.max(0, (E - bat.soc_min * Ebat)) * ec);
        E -= dis / ec; pb -= dis; need -= dis; E_batloss += dis / ec - dis;
        if (need > 0 && gridOn) { const g = Math.min(need, gridMax); pg += g; need -= g; }
        if (need > 0 && auxBackup > 0) { const g = Math.min(need, auxBackup); pg += g; need -= g; }
        unmet[h] = need;
      }
      if (PmaxH <= 0) { // whole plant out of service: charge the battery, otherwise export or curtail
        const ch = Math.max(0, Math.min(avail, Pbat - Math.max(0, -pb), Math.max(0, (bat.soc_max * Ebat - E)) / ec));
        E += ch * ec; pb += ch; E_batloss += ch - ch * ec; c = avail - ch;
      } else if (avail >= PminH) {
        pe = Math.min(avail, PmaxH);
        let surplus = avail - pe;
        if (gridOn && mode === 'full' && pe < PmaxH) { const g = Math.min(PmaxH - pe, gridMax - pg); pe += g; pg += g; }
        if (gridOn && mode === 'target' && pe < tgt) { const g = Math.min(tgt - pe, gridMax - pg); pe += g; pg += g; }
        const ch = Math.min(surplus, Pbat - Math.max(0, -pb), Math.max(0, (bat.soc_max * Ebat - E)) / ec);
        E += ch * ec; pb += ch; surplus -= ch; E_batloss += ch - ch * ec;
        c = surplus;
      } else {
        const deficit = PminH - avail;
        const canBat = Math.min(Pbat, Math.max(0, E - bat.soc_min * Ebat) * ec);
        if (running && canBat >= deficit) { // bridge at minimum load
          pe = PminH; E -= deficit / ec; pb -= deficit; E_batloss += deficit / ec - deficit;
        } else if (gridOn && (gridMax - pg) >= deficit) {
          pe = mode === 'full' ? Math.min(PmaxH, avail + gridMax - pg) : mode === 'target' ? Math.min(Math.max(tgt, PminH), avail + gridMax - pg) : PminH;
          pg += pe - avail;
        } else { // hot standby
          pe = 0;
          let sur = avail - PsbH;
          let served = PsbH;
          if (sur < 0) { const d = Math.min(-sur, Pbat, Math.max(0, E - bat.soc_min * Ebat) * ec); E -= d / ec; pb -= d; E_batloss += d / ec - d; sur += d; if (sur < 0 && gridOn) { const g = Math.min(-sur, gridMax - pg); pg += g; sur += g; } if (sur < 0 && auxBackup > pg) { const g = Math.min(-sur, auxBackup - pg); pg += g; sur += g; } if (sur < 0) served += sur; }
          else { const ch = Math.min(sur, Pbat, Math.max(0, bat.soc_max * Ebat - E) / ec); E += ch * ec; pb += ch; E_batloss += ch - ch * ec; c = sur - ch; }
          E_standby += Math.max(0, served);
        }
      }
      if (pe > 0) { if (!running) starts++; running = true; hRun++; if (pe <= PminH * 1.0001) hMin++; }
      else { running = false; if (a > 0) hStandby++; else hOut++; }
      // the available modules share the load: stack output = a · f(P/a)
      const hs = pe > 0 ? a * h2At(pe / a) : 0;
      if (pe > 0) { E_dc += a * dcAt(pe / a); E_qx += a * qxAt(pe / a); E_ht += a * htAt(pe / a); }
      E_auxTot += PauxH; lastLoad = pe / Pmax;
      elyKW[h] = pe; h2s[h] = hs; h2[h] = hs * (1 - purif); soc[h] = Ebat > 0 ? E / Ebat : 0; batKW[h] = pb; gridKW[h] = pg;
      if (hasComp && h2[h] > 0) { const pH = ppOn ? tab.pFromAC(cap(pe / a)) : tp.pH2; E_compH += h2[h] * (pH < tp.pH2 - 1e-6 ? secAt(st.comp_p_in - (tp.pH2 - pH)) : comp.SEC_kWhkg); }
      if (expOn) expKW[h] = Math.max(0, c); else curt[h] = Math.max(0, c);
      batThroughput += Math.abs(pb);
    }
    // Annual sums
    const sum = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
    const E_pv = sum(pvKW) / 1e3, E_wd = sum(wdKW) / 1e3, E_ely = sum(elyKW) / 1e3, E_curt = sum(curt) / 1e3, E_exp = sum(expKW) / 1e3, E_grid = sum(gridKW) / 1e3; // MWh
    const m_stack = sum(h2s) / 1000, m_H2 = sum(h2) / 1000; // t (stack output, product after gas processing)
    const CF = E_ely / (Pmax / 1000 * n);            // CM 14.5 (energy basis)
    const FLH = CF * n;
    // Storage: inventory with constant (or given) offtake – DM 13.1 / CM 14.7
    const buf = H2.buffer(h2, st.flex_h || 0, st.turndown == null ? 0.3 : st.turndown, st.maxup || 1.2);
    const off = buf.mean, inv = buf.inv, m_usable = buf.usable;
    const T_st = K(st.T_C || 25);
    const dRho = H2.rho(st.p_max, T_st) - H2.rho(st.p_min, T_st);
    const V_store = dRho > 0 ? m_usable / dRho : 0;  // DM 13.2
    const E_comp = E_compH / 1000;                   // MWh (suction pressure lowered at part load where the stack does so)
    // Water (DM 6.1)
    const V_DI = m_H2 * 1000 * cfg.water.w_DI / 1000;  // m3/a
    const V_raw = V_DI / cfg.water.Y;
    // Economics (DM 20.1/20.2)
    const ec_ = cfg.econ;
    const CRF = H2.CRF(ec_.WACC, ec_.life), df = y => Math.pow(1 + ec_.WACC, -y);
    const capex = {
      PV: (pvo.P_MWp || 0) * 1000 * (pvo.capex_EURkWp || 0) / 1e6,
      Wind: (wdo.P_MW || 0) * 1000 * (wdo.capex_EURkW || 0) / 1e6,
      Battery: Ebat * (bat.capex_EURkWh || 0) / 1e6,
      Electrolyser: P_ely * (cfg.ely.capex_EURkW || 0) / 1e6,
      Storage: st.enabled ? (st.size_kg > 0 ? st.size_kg : m_usable) * (st.capex_EURkg || 0) / 1e6 : 0,
      Other: ec_.other_capex_MEUR || 0
    };
    let direct = 0; for (const k in capex) direct += capex[k];
    const CAPEX = direct * (1 + ec_.f_ind) * (1 + ec_.f_cont + ec_.f_own);
    // stack replacements every t_rep operating hours, strictly before the end of the economic life (CM 6.6, DM 20.2)
    let nRepl = 0, PVstacks = 0; const stackCost = capex.Electrolyser * (cfg.ely.stack_frac || 0);
    if (hRun > 0) for (let k = 1; k <= 200; k++) { const yr = k * life.tRep / hRun; if (yr >= ec_.life - 1e-9) break; nRepl++; PVstacks += stackCost * df(yr); }
    // other equipment with a shorter life than the plant (battery, power electronics): replaced at its life
    const repl = []; let PVrepl = 0;
    const replItems = (ec_.replacements || []).slice(); if (capex.Battery > 0) replItems.push({ name: 'Battery', capex: capex.Battery, life: bat.life || 15 });
    replItems.forEach(r => { if (!(r.capex > 0 && r.life > 0)) return; let k = 0, pv = 0; for (let yr = r.life; yr < ec_.life - 1e-9 && k < 100; yr += r.life) { pv += r.capex * df(yr); k++; } if (k) { repl.push({ name: r.name, n: k, life: r.life, PV: pv }); PVrepl += pv; } });
    const opex = (capex.PV * (pvo.om_frac || 0) + capex.Wind * (wdo.om_frac || 0) + capex.Battery * (bat.om_frac || 0) + capex.Electrolyser * (cfg.ely.om_frac || 0)) + (ec_.fixed_opex_MEUR || 0);
    const E_auxServed = (E_auxTot - sum(unmet)) / 1000;                        // MWh
    const E_cons = E_ely + E_auxServed + E_standby / 1000;                     // MWh taken from the bus
    const ppa = ec_.ppa_price_EURMWh || 0;
    // grid electricity at the flat price or the hourly series; exported surplus at the export price or the hourly series;
    // low-price hours of Delegated Regulation (EU) 2023/1184 Art. 4(3): grid electricity in an hour whose day-ahead price is
    // at or below 20 EUR/MWh or 0.36 × the ETS allowance price counts as renewable (zero emissions)
    const thr = cfg.grid.lowPriceRule ? Math.max(20, 0.36 * (cfg.grid.ets_EURt || 0)) : null;
    let gridCostEUR = 0, expRevEUR = 0, gridCO2g = 0, gridLowKWh = 0, lowHours = 0, ciFull = 0; const gM_ci = new Float64Array(12), gM_e = new Float64Array(12);
    if (priceS || expS || ciS || thr != null) {
      let mo = 0, next = 24 * 31; const dm = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      for (let h = 0; h < n; h++) {
        if (h >= next) { mo++; next += 24 * dm[mo]; }
        const g = gridKW[h], pr = priceAt(h), ci = ciS ? ciS[h] : cfg.grid.CI_gkWh;
        gridCostEUR += g * pr / 1000; if (expOn) expRevEUR += expKW[h] * (expS ? expS[h] : (cfg.grid.export_price || 0)) / 1000;
        const low = thr != null && pr <= thr; if (low) { lowHours++; gridLowKWh += g; }
        ciFull += g * ci; gridCO2g += low ? 0 : g * ci; gM_ci[mo] += g * ci; gM_e[mo] += g;
      }
    }
    // PPA paid on the renewable energy used; with export the surplus is paid at the PPA price and sold at the export price
    const elecCost = priceS || expS ? (gridCostEUR + ppa * Math.max(0, E_cons - E_grid) + (expOn ? ppa * E_exp - expRevEUR : 0)) / 1e6
      : (E_grid * cfg.grid.price_EURMWh + ppa * Math.max(0, E_cons - E_grid) + (expOn ? (ppa - (cfg.grid.export_price || 0)) * E_exp : 0)) / 1e6;
    const gridCost = priceS ? gridCostEUR / 1e6 : E_grid * cfg.grid.price_EURMWh / 1e6;
    const E_heatExt = E_qx / 1000;                                              // MWh_th of external heat (SOEC steam)
    const heatCost = E_heatExt * (ec_.heat_price || 0) / 1e6;
    const waterCost = (V_raw * cfg.water.price_EURm3 + V_DI * (cfg.water.chem_EURm3 || 0)) / 1e6;
    const byprod = (m_stack * C.w_O2 * (ec_.O2_price_EURt || 0)) / 1e6;
    const annual = CRF * (CAPEX + PVstacks + PVrepl) + opex + elecCost + heatCost + waterCost - byprod;
    const mH = Math.max(m_H2, 1e-9);
    const LCOH = annual * 1000 / mH; // MEUR/t -> EUR/kg
    const breakdown = { capital: 1e3 * CRF * CAPEX / mH, stacks: 1e3 * CRF * PVstacks / mH };
    if (PVrepl > 0) breakdown['other replacements'] = 1e3 * CRF * PVrepl / mH;
    breakdown['O&M'] = 1e3 * opex / mH; breakdown.electricity = 1e3 * elecCost / mH;
    if (heatCost > 0) breakdown.heat = 1e3 * heatCost / mH;
    breakdown.water = 1e3 * waterCost / mH; breakdown['by-products'] = -1e3 * byprod / mH;
    // GHG intensity by the RFNBO method (Delegated Reg. (EU) 2023/1185): grid electricity at its emission factor,
    // renewable electricity at zero, no emissions from the manufacture of equipment (these are in the impact assessment)
    const SECavg = (E_ely * 1000) / Math.max(m_H2 * 1000, 1e-9);
    const hourlyCI = !!(ciS || thr != null);
    const CI_kgkg = hourlyCI ? gridCO2g / 1000 / (mH * 1000) : E_grid * cfg.grid.CI_gkWh / (mH * 1000);
    // temporal correlation (Delegated Reg. (EU) 2023/1184 Art. 6, DM 4.6): grid imports matched by renewable
    // electricity of the PPA exported in the same calendar month (allowed until 31 Dec 2029) – only with export
    let matched = 0, CI_monthly = null;
    if (expOn) { const gM = H2.monthly(gridKW), eM = H2.monthly(expKW);
      if (ciS) { let co2 = 0; for (let m = 0; m < 12; m++) { const mt = Math.min(gM[m], eM[m]); matched += mt; co2 += (gM[m] - mt) * (gM_e[m] > 0 ? gM_ci[m] / gM_e[m] : cfg.grid.CI_gkWh); } CI_monthly = co2 / 1000 / (mH * 1000); }
      else { for (let m = 0; m < 12; m++) matched += Math.min(gM[m], eM[m]); CI_monthly = ((E_grid * 1000 - matched) * cfg.grid.CI_gkWh / 1000) / (mH * 1000); } }
    let aMean = 0; for (let h = 0; h < n; h++) aMean += availA[h]; aMean /= n;
    const siteKPI = priceS || ciS || thr != null || mode0 === 'price' ? { grid_cost_MEUR: gridCost, grid_price_paid: E_grid > 0 ? gridCost * 1e6 / E_grid : null, grid_CI_mean: E_grid > 0 ? ciFull / (E_grid * 1000) : null,
      lowprice_hours: thr != null ? lowHours : null, lowprice_threshold: thr, grid_lowprice_GWh: thr != null ? gridLowKWh / 1e6 : null, CI_nolowprice: thr != null ? ciFull / 1000 / (mH * 1000) : null, price_cap: mode0 === 'price' ? pCap : null,
      export_revenue_MEUR: expOn ? (expS ? expRevEUR / 1e6 : (cfg.grid.export_price || 0) * E_exp / 1e6) : 0 } : null;
    return {
      series: { pv: pvKW, wind: wdKW, ely: elyKW, h2, h2stack: h2s, soc, bat: batKW, curt, exp: expKW, grid: gridKW, inv, off: buf.off, ghi: W.ghi, poa: poa || new Float64Array(n), ws: W.ws, tam: W.tam, unmet, avail: availA, price: priceS, ci: ciS },
      site: siteKPI,
      kpi: {
        E_pv_GWh: E_pv / 1000, E_wind_GWh: E_wd / 1000, E_RE_GWh: (E_pv + E_wd) / 1000, E_ely_GWh: E_ely / 1000, E_curt_GWh: E_curt / 1000, E_export_GWh: E_exp / 1000,
        curt_share: E_curt / Math.max(E_pv + E_wd, 1e-9), export_share: E_exp / Math.max(E_pv + E_wd, 1e-9), E_grid_GWh: E_grid / 1000, grid_share: E_grid / Math.max(E_ely, 1e-9),
        CF, FLH, H2_t: m_H2, H2_stack_t: m_stack, purif_loss: purif, starts, hours_min: hMin, hours_run: hRun, hours_standby: hStandby, hours_out: hOut, availability: aMean,
        minLoad_eff: minLoad, minLoad_purity: minPur, partPressure: ppOn ? { pPart: tp.pPart, Lnom: H2.partPressure(tp, xTrip).Lnom } : null, t_rep_h: life.tRep, t_EoL_h: life.tEoL, degr_frac: degr, repl_limit: life.limitedBy,
        bat_cycles: Ebat > 0 ? batThroughput / 2 / 1000 / (Ebat / 1000) : 0, SEC_avg: SECavg,
        CF_pv: E_pv / Math.max((pvo.P_MWp || 0) * n, 1e-9), CF_wind: E_wd / Math.max((wdo.P_MW || 0) * n, 1e-9),
        offtake_kgh: off, buffer_t: m_usable / 1000, buffer_V_m3: V_store, comp_SEC: comp.SEC_kWhkg, comp_N: comp.N, comp_T2: comp.T2_C, E_comp_MWh: E_comp,
        V_DI_m3a: V_DI, V_raw_m3a: V_raw, unmet_MWh: sum(unmet) / 1000,
        CAPEX_MEUR: CAPEX, direct_MEUR: direct, PVstacks_MEUR: PVstacks, PVrepl_MEUR: PVrepl, replacements: repl, opex_MEUR: opex, elec_MEUR: elecCost, heat_MEUR: heatCost, water_MEUR: waterCost, CRF, LCOH,
        CI_kgkg, CI_monthly, grid_matched_GWh: matched / 1e6, stack_replacements: nRepl,
        Pmax_kW: Pmax, Pmin_kW: minLoad * Pmax,
        E_dc_GWh: E_dc / 1e6, E_batloss_GWh: E_batloss / 1e6, E_standby_GWh: E_standby / 1e6, E_bat_delta_GWh: (E - E0bat) / 1e6,
        E_aux_GWh: E_auxServed / 1000, E_H2_LHV_GWh: m_H2 * C.LHV / 1000, E_H2_stack_LHV_GWh: m_stack * C.LHV / 1000, E_H2_stack_HHV_GWh: m_stack * C.HHV / 1000,
        E_heat_el_GWh: E_ht / 1e6, E_heat_ext_GWh: E_heatExt / 1000,
        E_conv_GWh: (E_dc / etaConv - E_dc) / 1e6, E_bop_GWh: Math.max(0, E_ely / 1000 - E_dc / etaConv / 1e6 - E_ht / 1e6)
      },
      capex, breakdown, table: tab ? tab.pts : null
    };
  };

  /* Buffer from an hourly production profile (CM 14.7, DM 13.1).
     Offtake = flat mean, or a rolling mean over window_h hours clipped to
     [turndown, maxup] x mean (flexible customer, e.g. ammonia loop). */
  H2.buffer = function (h2, window_h, turndown, maxup) {
    const n = h2.length; let mean = 0; for (let i = 0; i < n; i++) mean += h2[i]; mean /= n;
    const off = new Float64Array(n), inv = new Float64Array(n);
    if (!(mean > 0)) return { usable: 0, inv, off, mean: 0 };           // no production: no inventory to buffer
    if (!window_h) off.fill(mean);
    else {
      let acc = 0; const w = Math.max(1, Math.round(window_h));
      for (let i = 0; i < n + w; i++) { acc += h2[i % n]; if (i >= w) acc -= h2[(i - w) % n]; if (i >= w - 1) { const c = (i - Math.floor(w / 2) + n) % n; off[c] = acc / w; } }
      let s2 = 0; for (let i = 0; i < n; i++) { off[i] = Math.min(maxup * mean, Math.max(turndown * mean, off[i])); s2 += off[i]; }
      if (s2 > 0) { const f = mean * n / s2; for (let i = 0; i < n; i++) off[i] *= f; } else off.fill(mean); // preserve annual balance
    }
    let I = 0, mx = -Infinity, mn = Infinity;
    for (let i = 0; i < n; i++) { I += h2[i] - off[i]; inv[i] = I; if (I > mx) mx = I; if (I < mn) mn = I; }
    for (let i = 0; i < n; i++) inv[i] -= mn;
    return { usable: mx - mn, inv, off, mean };
  };

  /* Monthly aggregation helper */
  H2.monthly = function (arr, fn) {
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; const out = []; let h = 0;
    for (let m = 0; m < 12; m++) { let s = 0; const hh = days[m] * 24; for (let i = 0; i < hh; i++) s += arr[h + i]; out.push(fn ? fn(s, hh) : s); h += hh; }
    return out;
  };

  if (typeof module !== 'undefined') module.exports = H2;
})(typeof window !== 'undefined' ? window : globalThis);

;
/* Hasim – Green Hydrogen Engineering Suite. © 2026 Prof. Hani Muhsen. All rights reserved. */
/* =====================================================================
   Hasim – equation library.  Every numbered equation of the
   Calculations Manual formulary (CM, Appendix C) and the design-equation
   boxes of the Plant Design Manual (DM) as an executable calculator.
   Each entry: id, src (CM|DM), ref (equation number), level, title,
   formula (display), inputs [key,label,unit,default], outputs
   [key,label,unit], f(inputs)->outputs
   ===================================================================== */
(function (root) {
  'use strict';
  const H2 = root.H2;
  const C = H2.C, K = H2.K;
  const EQ = H2.EQ = [];
  const LEVELS = H2.LEVELS = [
    'Properties & units', 'Thermodynamics', 'Cell', 'Stack & power electronics', 'System efficiency & balances',
    'Renewable supply', 'Water supply & treatment', 'Cooling & heat', 'Compression & purification', 'Storage',
    'Transport', 'Power-to-X & end use', 'Economics', 'Environment & certification', 'Safety & materials', 'Design basis & reliability'];
  function add(src, ref, level, title, formula, inputs, outputs, f, note) {
    EQ.push({ id: src + '-' + ref, src, ref, level, title, formula, inputs, outputs, f, note: note || '' });
  }
  const log10 = Math.log10, ln = Math.log, sqrt = Math.sqrt, pow = Math.pow, exp = Math.exp, PI = Math.PI;
  const list = v => (Array.isArray(v) ? v : String(v).split(/[;,\s]+/).filter(s => s !== '').map(Number));
  H2.list = list;

  /* ============ CM Chapter 1 – conversions ============ */
  add('CM', '1.1', 0, 'Volume to mass', 'm = ρN·VN,  ρN = 0.08994 kg/Nm³',
    [['VN', 'Normal volume (flow)', 'Nm³ (/h)', 500]], [['m', 'Mass (flow)', 'kg (/h)'], ['m_td', 'Daily mass', 't/d']],
    x => ({ m: C.rhoN * x.VN, m_td: C.rhoN * x.VN * 24 / 1000 }));
  add('CM', '1.2', 0, 'Energy content', 'E = m·LHV  or  m·HHV   (LHV 33.32, HHV 39.41 kWh/kg)',
    [['m', 'Hydrogen mass (flow)', 'kg (/h)', 44.97]], [['E_LHV', 'Energy LHV', 'kWh (kW)'], ['E_HHV', 'Energy HHV', 'kWh (kW)'], ['E_MJ', 'Energy LHV', 'MJ']],
    x => ({ E_LHV: x.m * C.LHV, E_HHV: x.m * C.HHV, E_MJ: x.m * C.LHV_MJ }));
  add('CM', '1.3', 0, 'Power to production', 'ṁ = P_el / SEC',
    [['P', 'Electrical power', 'kW', 20000], ['SEC', 'Specific energy consumption', 'kWh/kg', 53]],
    [['mdot', 'Hydrogen flow', 'kg/h'], ['mdot_td', 'Daily', 't/d'], ['VN', 'Volume flow', 'Nm³/h']],
    x => { const m = x.P / x.SEC; return { mdot: m, mdot_td: m * 24 / 1000, VN: m / C.rhoN }; });
  add('CM', '1.4', 0, 'Annual production', 'm_year = P_rated·8760·CF / SEC',
    [['P', 'Rated power', 'kW', 20000], ['CF', 'Capacity factor', '–', 0.45], ['SEC', 'SEC', 'kWh/kg', 53]],
    [['E', 'Annual electricity', 'MWh/a'], ['m', 'Annual hydrogen', 't/a'], ['FLH', 'Full-load hours', 'h/a'], ['NH3', 'Equivalent ammonia (0.178)', 't/a']],
    x => { const m = x.P * 8760 * x.CF / x.SEC / 1000; return { E: x.P * 8760 * x.CF / 1000, m, FLH: 8760 * x.CF, NH3: m / 0.178 }; });

  /* ============ CM Chapter 2 – properties ============ */
  add('CM', '2.1', 0, 'Ideal-gas density', 'pV = mR′T,   ρ = p/(R′T),  R′ = 4124.5 J/(kg K)',
    [['p', 'Pressure', 'bar', 1.05], ['T', 'Temperature', '°C', 70], ['V', 'Volume (flow)', 'm³ (/h)', 620]],
    [['rho', 'Density', 'kg/m³'], ['m', 'Mass (flow)', 'kg (/h)'], ['VN', 'Normal volume', 'Nm³ (/h)']],
    x => { const r = H2.rhoIdeal(x.p, K(x.T)); return { rho: r, m: r * x.V, VN: r * x.V / C.rhoN }; });
  add('CM', '2.4', 0, 'Real-gas density (Abel–Noble)', 'ρ = p/(Z R′T),  Z = 1 + b′p/(R′T),  b′ = 7.69×10⁻³ m³/kg',
    [['p', 'Pressure', 'bar', 700], ['T', 'Temperature', '°C', 15]],
    [['Z', 'Compressibility factor', '–'], ['rho', 'Real density', 'kg/m³'], ['rho_id', 'Ideal density', 'kg/m³']],
    x => ({ Z: H2.Z(x.p, K(x.T)), rho: H2.rho(x.p, K(x.T)), rho_id: H2.rhoIdeal(x.p, K(x.T)) }));
  add('CM', '2.5', 0, 'Mass in a vessel', 'm = pV/(R′T + b′p)',
    [['V', 'Volume', 'm³', 0.05], ['p', 'Pressure', 'bar', 700], ['T', 'Temperature', '°C', 15]],
    [['m', 'Real-gas mass', 'kg'], ['m_id', 'Ideal-gas mass', 'kg'], ['E', 'Energy stored (LHV)', 'kWh']],
    x => { const m = H2.massInVessel(x.V, x.p, K(x.T)); return { m, m_id: x.V * H2.rhoIdeal(x.p, K(x.T)), E: m * C.LHV }; });
  add('CM', '2.6', 0, 'Joule–Thomson temperature change', 'ΔT ≈ μJT·Δp,  μJT ≈ −0.03 K/bar (H₂ warms on expansion)',
    [['dp', 'Pressure drop', 'bar', 700], ['mu', 'μJT', 'K/bar', -0.03]], [['dT', 'Temperature rise', 'K']],
    x => ({ dT: -x.mu * x.dp }));
  add('CM', '2.7', 0, 'HHV – LHV difference', 'HHV − LHV = 8.937·Δh_vap,H₂O',
    [['dh', 'Latent heat of water', 'MJ/kg', 2.442]], [['diff', 'HHV − LHV', 'MJ/kg'], ['diff_kWh', 'HHV − LHV', 'kWh/kg']],
    x => ({ diff: 8.937 * x.dh, diff_kWh: 8.937 * x.dh / 3.6 }));
  add('CM', '2.11', 0, 'Stoichiometric air', '(A/F)st = 34.3 kg/kg,  x_st = 29.5 vol-%',
    [['m', 'Hydrogen flow', 'kg/h', 1], ['lambda', 'Air ratio λ', '–', 1]], [['air', 'Air flow', 'kg/h'], ['xst', 'Stoich. H₂ in air', 'vol-%']],
    x => ({ air: C.AF_st * x.lambda * x.m, xst: 29.5 }));

  /* ============ CM Chapter 3 – thermodynamics ============ */
  add('CM', '3.2', 1, 'Energy balance of water splitting', 'ΔH = ΔG + TΔS;  E_rev = ΔG/2F, E_tn = ΔH/2F  (3.3)',
    [['dH', 'ΔH', 'kJ/mol', 285.83], ['dS', 'ΔS', 'J/(mol K)', 163.31], ['T', 'Temperature', 'K', 298.15]],
    [['dG', 'ΔG', 'kJ/mol'], ['Erev', 'Reversible voltage', 'V'], ['Etn', 'Thermoneutral voltage', 'V'], ['fel', 'Electrical share ΔG/ΔH', '–']],
    x => { const dG = x.dH - x.T * x.dS / 1000; return { dG, Erev: dG * 1000 / (2 * C.F), Etn: x.dH * 1000 / (2 * C.F), fel: dG / x.dH }; });
  add('CM', '3.5', 1, 'Reversible voltage vs temperature (liquid water)', 'E_rev = 1.5184 − 1.5421×10⁻³T + 9.523×10⁻⁵ T lnT + 9.84×10⁻⁸ T²',
    [['T', 'Temperature', '°C', 80]], [['Erev', 'E_rev(T)', 'V'], ['Erev_steam', 'E_rev steam feed (JANAF fit)', 'V'], ['Etn_steam', 'E_tn steam feed', 'V']],
    x => ({ Erev: H2.ErevT(K(x.T)), Erev_steam: H2.ErevSteam(K(x.T)), Etn_steam: H2.EtnSteam(K(x.T)) }));
  add('CM', '3.6', 1, 'Nernst equation', 'E_rev(p) = E°_rev + (RT/2F)·ln(p_H₂ p_O₂^½ / a_H₂O)',
    [['T', 'Temperature', '°C', 80], ['pH2', 'H₂ pressure', 'bar', 30], ['pO2', 'O₂ pressure', 'bar', 30], ['a', 'Water activity', '–', 1]],
    [['E0', 'E°_rev(T)', 'V'], ['E', 'E_rev(T,p)', 'V'], ['dE', 'Pressure penalty ΔE', 'V'], ['dSEC', 'ΔSEC', 'kWh/kg']],
    x => { const E0 = H2.ErevT(K(x.T)); const E = H2.nernst(E0, K(x.T), x.pH2, x.pO2, x.a); return { E0, E, dE: E - E0, dSEC: C.kSEC * (E - E0) }; });
  add('CM', '3.8', 1, 'Thermodynamic efficiencies', 'η_HHV = 1.481/E_cell;  η_LHV = 1.253/E_cell;  η_ΔG = E_rev/E_cell',
    [['E', 'Cell voltage', 'V', 1.9], ['T', 'Temperature', '°C', 80]],
    [['eHHV', 'η_HHV', '–'], ['eLHV', 'η_LHV', '–'], ['eG', 'η_ΔG', '–'], ['SEC', 'SEC stack (3.12/7.5)', 'kWh/kg']],
    x => ({ eHHV: 1.481 / x.E, eLHV: 1.253 / x.E, eG: H2.ErevT(K(x.T)) / x.E, SEC: C.kSEC * x.E }));
  add('CM', '3.10', 1, 'Stack heat generation', 'Q̇ = P_stack·(1 − E_tn/E_cell)',
    [['P', 'Stack power', 'kW', 1000], ['E', 'Cell voltage', 'V', 1.9], ['Etn', 'Thermoneutral voltage', 'V', 1.481], ['fgas', 'Heat leaving with gases', '–', 0.1], ['dT', 'Coolant ΔT', 'K', 10]],
    [['Q', 'Heat generated', 'kW'], ['Qloop', 'Heat to cooling loop', 'kW'], ['mcw', 'Cooling water', 'kg/s'], ['Vcw', 'Cooling water', 'm³/h']],
    x => { const Q = x.P * (1 - x.Etn / x.E); const Ql = Q * (1 - x.fgas); const mc = Ql / (4.18 * x.dT); return { Q, Qloop: Ql, mcw: mc, Vcw: mc * 3.6 }; });
  add('CM', '3.12', 1, 'SOEC energy split', 'w_el = 26.59·E_cell;  q_cell = 26.59·(E_tn − E_cell)  [kWh/kg]',
    [['E', 'Cell voltage', 'V', 1.1], ['Etn', 'Thermoneutral voltage', 'V', 1.287]],
    [['wel', 'Electricity', 'kWh/kg'], ['q', 'Heat to supply', 'kWh/kg'], ['tot', 'Total energy', 'kWh/kg']],
    x => ({ wel: C.kSEC * x.E, q: C.kSEC * (x.Etn - x.E), tot: C.kSEC * x.Etn }));

  /* ============ CM Chapter 4 – kinetics ============ */
  add('CM', '4.2', 2, "Faraday's law", 'ṁ_H₂ = η_F·M_H₂·I/(2F) = η_F × 0.03761 g/(A h) per cell',
    [['N', 'Cells', '–', 100], ['I', 'Current', 'A', 5000], ['etaF', 'Faradaic efficiency', '–', 0.985]],
    [['mH2', 'H₂', 'kg/h'], ['VN', 'H₂', 'Nm³/h'], ['mO2', 'O₂', 'kg/h'], ['mH2O', 'Water consumed', 'kg/h']],
    x => { const m = x.etaF * C.M_H2 * x.I * x.N / (2 * C.F) * 3600; return { mH2: m, VN: m / C.rhoN, mO2: m * C.w_O2, mH2O: m * C.w_H2O }; });
  add('CM', '4.4', 2, 'Cell voltage (full model)', 'E_cell = E_rev + η_act,a + η_act,c + j·ASR + η_conc',
    [['T', 'Temperature', '°C', 80], ['pH2', 'p_H₂', 'bar', 1], ['pO2', 'p_O₂', 'bar', 1], ['j', 'Current density', 'A/cm²', 2], ['j0a', 'j₀ anode', 'A/cm²', 2e-7], ['j0c', 'j₀ cathode', 'A/cm²', 1e-2], ['alpha', 'α', '–', 1.5], ['ASR', 'ASR', 'Ω cm²', 0.15], ['jlim', 'Limiting current (0 = off)', 'A/cm²', 0]],
    [['Erev', 'E_rev', 'V'], ['ea', 'η_act,a', 'V'], ['ec', 'η_act,c', 'V'], ['eo', 'η_ohm', 'V'], ['en', 'η_conc', 'V'], ['E', 'E_cell', 'V'], ['SEC', 'SEC stack', 'kWh/kg'], ['eHHV', 'η_HHV', '–']],
    x => { const c = H2.cell({ T_C: x.T, pH2: x.pH2, pO2: x.pO2, aH2O: 1, j0a: x.j0a, j0c: x.j0c, alpha: x.alpha, ASR: x.ASR, jlim: x.jlim > 0 ? x.jlim : 0, Psi: 0 }, x.j);
      return { Erev: c.Erev, ea: c.eta_a, ec: c.eta_c, eo: c.eta_ohm, en: c.eta_conc, E: c.Ecell, SEC: c.SEC_stack, eHHV: c.eff_HHV }; });
  add('CM', '4.5', 2, 'Butler–Volmer (symmetric)', 'η_act = (RT/αF)·arsinh(j/2j₀)',
    [['T', 'Temperature', '°C', 80], ['j', 'Current density', 'A/cm²', 1], ['j0', 'Exchange current density', 'A/cm²', 2e-7], ['alpha', 'Transfer coefficient α', '–', 1.5]],
    [['RTaF', 'RT/(αF)', 'V'], ['eta', 'η_act', 'V'], ['b', 'Tafel slope', 'mV/dec']],
    x => { const T = K(x.T); return { RTaF: C.R * T / (x.alpha * C.F), eta: H2.etaAct(x.j, x.j0, x.alpha, T), b: 2303 * C.R * T / (x.alpha * C.F) }; });
  add('CM', '4.6', 2, 'Tafel equation', 'η_act = b·log₁₀(j/j₀),  b = 2.303RT/(αF)',
    [['T', 'Temperature', '°C', 80], ['j', 'Current density', 'A/cm²', 1], ['j0', 'j₀', 'A/cm²', 2e-7], ['alpha', 'α', '–', 1.5]],
    [['b', 'Tafel slope', 'V/dec'], ['eta', 'η_act', 'V']],
    x => ({ b: 2.303 * C.R * K(x.T) / (x.alpha * C.F), eta: H2.tafel(x.j, x.j0, x.alpha, K(x.T)) }));
  add('CM', '4.7', 2, 'Ohmic loss', 'η_ohm = j·ASR,  ASR = Σ δᵢ/σᵢ + R_contact',
    [['j', 'Current density', 'A/cm²', 2], ['delta', 'Layer thicknesses (list)', 'µm', '183'], ['sigma', 'Conductivities (list)', 'S/cm', '0.199'], ['Rc', 'Contact resistance', 'Ω cm²', 0]],
    [['ASR', 'ASR', 'Ω cm²'], ['eta', 'η_ohm', 'V']],
    x => { const d = list(x.delta), s = list(x.sigma); let a = x.Rc; d.forEach((di, i) => { a += di * 1e-4 / (s[i] || s[0]); }); return { ASR: a, eta: x.j * a }; });
  add('CM', '4.8', 2, 'Nafion conductivity', 'σ = (0.005139λ − 0.00326)·exp[1268(1/303 − 1/T)]',
    [['lambda', 'Water content λ', '–', 22], ['T', 'Temperature', '°C', 80], ['delta', 'Membrane thickness', 'µm', 183]],
    [['sigma', 'σ', 'S/cm'], ['ASR', 'Membrane ASR', 'Ω cm²']],
    x => { const s = H2.nafionSigma(x.lambda, K(x.T)); return { sigma: s, ASR: x.delta * 1e-4 / s }; });
  add('CM', '4.9', 2, 'Bubble effect on conductivity', 'σ_eff = σ·(1 − ε)^1.5  (Bruggeman)',
    [['sigma', 'Electrolyte conductivity', 'S/cm', 1.2], ['eps', 'Gas void fraction', '–', 0.2], ['gap', 'Electrolyte gap', 'cm', 0.1]],
    [['seff', 'σ_eff', 'S/cm'], ['R', 'Gap resistance', 'Ω cm²']],
    x => { const s = x.sigma * pow(1 - x.eps, 1.5); return { seff: s, R: x.gap / s }; });
  add('CM', '4.10', 2, 'Concentration overpotential', 'η_conc = −(RT/nF)·ln(1 − j/j_lim)',
    [['T', 'Temperature', '°C', 80], ['j', 'Current density', 'A/cm²', 2], ['jlim', 'Limiting current density', 'A/cm²', 4], ['n', 'Electrons n', '–', 2]],
    [['eta', 'η_conc', 'V']], x => ({ eta: H2.etaConc(x.j, x.jlim, K(x.T), x.n) }));

  /* ============ CM Chapter 5/6 – technologies, stack, power supply ============ */
  add('CM', '5.1', 3, 'Active area and catalyst', 'A = P_DC/(j·E_cell);  m_cat = A·L_cat',
    [['P', 'DC power', 'MW', 1000], ['j', 'Current density', 'A/cm²', 2], ['E', 'Cell voltage', 'V', 1.85], ['L', 'Catalyst loading', 'mg/cm²', 1.5]],
    [['A', 'Active area', 'm²'], ['mcat', 'Catalyst mass', 'kg'], ['spec', 'Specific catalyst', 'kg/MW']],
    x => { const A = x.P * 1e6 / (x.j * x.E); return { A: A / 1e4, mcat: A * x.L / 1e6, spec: A * x.L / 1e6 / x.P }; });
  add('CM', '6.1', 3, 'Stack relations', 'I = j·A_cell;  V = N·E_cell;  P = N·E_cell·j·A_cell',
    [['A', 'Cell area', 'cm²', 1500], ['j', 'Current density', 'A/cm²', 2], ['E', 'Cell voltage', 'V', 1.85], ['N', 'Cells per stack', '–', 150], ['etaF', 'η_F', '–', 0.99], ['Pmod', 'Module power', 'kW', 5000]],
    [['I', 'Stack current', 'A'], ['V', 'Stack voltage', 'V'], ['P', 'Stack power', 'kW'], ['mdot', 'H₂ per stack', 'kg/h'], ['Nst', 'Stacks per module', '–'], ['SEC', 'SEC stack', 'kWh/kg']],
    x => { const I = x.j * x.A, V = x.N * x.E, P = I * V / 1000; const m = x.etaF * C.M_H2 * I * x.N / (2 * C.F) * 3600; return { I, V, P, mdot: m, Nst: Math.round(x.Pmod / P), SEC: P / m }; });
  add('CM', '6.3', 3, 'Power supply rating', 'P_AC = P_DC/η_rect;  S = P_AC·(1 + k)/cos φ',
    [['PDC', 'DC power', 'kW', 5000], ['eta', 'Rectifier efficiency', '–', 0.97], ['k', 'Margin k', '–', 0.15], ['cosphi', 'Power factor', '–', 0.93]],
    [['PAC', 'AC power', 'kW'], ['loss', 'Rectifier loss', 'kW'], ['S', 'Transformer rating', 'kVA']],
    x => { const P = x.PDC / x.eta; return { PAC: P, loss: P - x.PDC, S: P * (1 + x.k) / x.cosphi }; });
  add('CM', '6.4', 3, 'System power consumption', 'P_AC,sys = P_DC/(η_rect·η_trafo) + P_BoP,fixed + k_BoP·P_DC',
    [['PDC', 'DC stack power', 'kW', 5000], ['er', 'η_rect', '–', 0.97], ['et', 'η_trafo', '–', 0.99], ['Pf', 'Fixed BoP', 'kW', 60], ['k', 'Variable BoP k', '–', 0.04], ['mdot', 'H₂ production', 'kg/h', 100]],
    [['P', 'System AC power', 'kW'], ['SEC', 'System SEC', 'kWh/kg']],
    x => { const P = x.PDC / (x.er * x.et) + x.Pf + x.k * x.PDC; return { P, SEC: P / x.mdot }; });
  add('CM', '6.6', 3, 'Degradation and end of life', 'E_cell(t) = E_cell(0) + r_d·t;  t_EoL = f_EoL·E_cell(0)/r_d',
    [['E0', 'Initial cell voltage', 'V', 1.85], ['rd', 'Degradation rate', 'µV/h', 5], ['f', 'EoL voltage increase f_EoL', '–', 0.1], ['h', 'Operating hours per year', 'h/a', 8000], ['etaF', 'η_F', '–', 0.99]],
    [['tEoL', 'Stack life', 'h'], ['tEoL_a', 'Stack life', 'a'], ['EEoL', 'EoL voltage', 'V'], ['SEC0', 'SEC BoL', 'kWh/kg'], ['SEC1', 'SEC EoL', 'kWh/kg'], ['SECavg', 'SEC life average', 'kWh/kg']],
    x => { const t = x.f * x.E0 / (x.rd * 1e-6); const E1 = x.E0 * (1 + x.f); const s0 = C.kSEC * x.E0 / x.etaF, s1 = C.kSEC * E1 / x.etaF; return { tEoL: t, tEoL_a: t / x.h, EEoL: E1, SEC0: s0, SEC1: s1, SECavg: (s0 + s1) / 2 }; });

  /* ============ CM Chapter 7 – efficiency ============ */
  add('CM', '7.5', 4, 'Specific energy consumption', 'SEC_stack = 26.59·E_cell/η_F [kWh/kg];  SEC[kWh/Nm³] = 0.08994·SEC[kWh/kg]',
    [['E', 'Cell voltage', 'V', 1.918], ['etaF', 'η_F', '–', 1]],
    [['SEC', 'SEC', 'kWh/kg'], ['SECN', 'SEC', 'kWh/Nm³'], ['eHHV', 'η_HHV', '–'], ['eLHV', 'η_LHV', '–']],
    x => { const s = C.kSEC * x.E / x.etaF; return { SEC: s, SECN: s * C.rhoN, eHHV: C.HHV / s, eLHV: C.LHV / s }; });
  add('CM', '7.6', 4, 'Gas cross-over and Faradaic efficiency', 'ṅ″ = (Ψ·p_H₂ + κ·j)/δ + φ·S_H₂·p_H₂·V̇/A;  j_cross = 2F·ṅ″;  η_F ≈ 1 − j_cross/j',
    [['Psi', 'Permeability Ψ (saturated diffusion)', 'mol/(cm s bar)', 2e-11], ['kappa', 'Supersaturation coefficient κ', 'mol/(cm s) per A/cm²', 3.3e-10], ['dp', 'H₂ partial pressure', 'bar', 30], ['delta', 'Separator thickness', 'cm', 0.0183], ['j', 'Current density', 'A/cm²', 2], ['lye', 'Mixed lye circulation V̇/A (0 = PEM or separated cycles)', 'L/(min m²)', 0]],
    [['n', 'Crossover flux', 'mol/(cm² s)'], ['ndiff', 'Diffusion share', '–'], ['nss', 'Supersaturation share', '–'], ['nmix', 'Lye-mixing share', '–'], ['jx', 'j_cross', 'A/cm²'], ['etaF', 'η_F', '–']],
    x => { const c = H2.crossover({ Psi: x.Psi, kappa: x.kappa, pH2: x.dp, delta_cm: x.delta, mixedLye: x.lye > 0, lye_Lmin_m2: x.lye }, x.j); const jx = 2 * C.F * c.nx;
      return { n: c.nx, ndiff: c.diff / c.nx, nss: c.ss / c.nx, nmix: c.mix / c.nx, jx, etaF: 1 - jx / x.j }; });
  add('CM', '7.7', 4, 'Hydrogen in oxygen', 'x = ṅ″/(ṅ″ + j/4F) ≤ 2 %;  for a load-independent flux j_min = 4F·ṅ″·(1 − x_trip)/x_trip',
    [['n', 'Crossover flux ṅ″', 'mol/(cm² s)', 3.28e-8], ['j', 'Current density', 'A/cm²', 0.2]],
    [['x', 'H₂ in O₂', '–'], ['jmin', 'Minimum j for 2 %', 'A/cm²']],
    x => ({ x: x.n / (x.n + x.j / (4 * C.F)), jmin: 4 * C.F * x.n * (1 - 0.02) / 0.02 }));
  add('CM', '7.8', 4, 'Part-load system SEC', 'SEC_sys(L) = SEC_stack(L)/η_rect + (P_BoP,fixed + k_BoP·L·P_n)/ṁ(L)',
    [['Pn', 'Nominal power', 'kW', 1000], ['L', 'Load fraction', '–', 0.3], ['E', 'Cell voltage at L', 'V', 1.66], ['er', 'η_rect', '–', 0.96], ['Pf', 'Fixed BoP', 'kW', 30], ['k', 'Variable BoP', '–', 0.02], ['etaF', 'η_F', '–', 1]],
    [['SECst', 'SEC stack', 'kWh/kg'], ['mdot', 'H₂', 'kg/h'], ['SEC', 'SEC system', 'kWh/kg']],
    x => { const s = C.kSEC * x.E / x.etaF; const m = x.L * x.Pn / s; return { SECst: s, mdot: m, SEC: s / x.er + (x.Pf + x.k * x.L * x.Pn) / m }; });
  add('CM', '7.10', 4, 'Chain efficiency', 'η_chain = Π ηᵢ',
    [['etas', 'Efficiencies (list)', '–', '0.98, 0.67, 0.9, 0.5']], [['eta', 'Chain efficiency', '–']],
    x => ({ eta: list(x.etas).reduce((a, b) => a * b, 1) }));

  /* ============ CM Chapter 8 – balances ============ */
  add('CM', '8.1', 4, 'Raw-water demand', 'ṁ_raw = ṁ_H₂·(8.937 + w_vap + w_misc)/Y_RO + ṁ_cooling',
    [['m', 'Hydrogen', 't/a', 8420], ['w', 'Losses w_vap + w_misc', 'kg/kg', 0.4], ['Y', 'RO recovery', '–', 0.65], ['mc', 'Cooling make-up', 't/a', 0], ['eRO', 'RO energy', 'kWh/m³', 3]],
    [['DI', 'Demineralised water', 'm³/a'], ['raw', 'Raw water', 'm³/a'], ['reject', 'Reject', 'm³/a'], ['ERO', 'RO energy', 'MWh/a'], ['spec', 'Specific raw water', 'L/kg']],
    x => { const DI = x.m * (8.937 + x.w); const raw = DI / x.Y + x.mc; return { DI, raw, reject: DI / x.Y - DI, ERO: raw * x.eRO / 1000, spec: raw / x.m }; });
  add('CM', '8.2', 4, 'Water vapour pressure (Antoine)', 'log₁₀ p_w[mmHg] = 8.07131 − 1730.63/(233.426 + ϑ)',
    [['T', 'Temperature', '°C', 80]], [['p', 'p_sat', 'bar'], ['pmm', 'p_sat', 'mmHg']],
    x => ({ p: H2.pSatWater(x.T), pmm: pow(10, 8.07131 - 1730.63 / (233.426 + x.T)) }));
  add('CM', '8.3', 4, 'Moisture content of wet hydrogen', 'w = 8.937·y/(1 − y),  y = p_sat/p',
    [['T', 'Temperature', '°C', 80], ['p', 'Pressure', 'bar', 30], ['m', 'H₂ flow', 'kg/h', 100]],
    [['y', 'Water mole fraction', '–'], ['w', 'Water per kg H₂', 'kg/kg'], ['mw', 'Water carried', 'kg/h']],
    x => { const y = H2.pSatWater(x.T) / x.p; const w = 8.937 * y / (1 - y); return { y, w, mw: w * x.m }; });
  add('CM', '8.4', 8, 'Deoxo reactor', 'H₂ consumed = 2y_O₂;  ΔT_ad ≈ 16 800·y_O₂ K',
    [['y', 'O₂ in H₂ (mole fraction)', '–', 0.005], ['m', 'H₂ flow', 'kg/h', 100]],
    [['frac', 'H₂ consumed (mole frac.)', '–'], ['dT', 'Adiabatic ΔT', 'K'], ['loss', 'H₂ loss', 'kg/h']],
    x => ({ frac: 2 * x.y, dT: 16800 * x.y, loss: 2 * x.y * x.m }));
  add('CM', '8.5', 7, 'Plant heat rejection', 'Q̇_reject = P_DC(1 − E_tn/E_cell) + P_loss,PE + Q̇_cond + Q̇_comp − Q̇_gas − Q̇_rec',
    [['PDC', 'DC power', 'kW', 100000], ['E', 'Cell voltage', 'V', 1.9], ['PE', 'Power-electronics loss', 'kW', 3000], ['cond', 'Condenser duty', 'kW', 1500], ['comp', 'Compressor intercooling', 'kW', 2000], ['gas', 'Heat with gases', 'kW', 2200], ['rec', 'Recovered heat', 'kW', 0]],
    [['stack', 'Stack heat', 'kW'], ['Q', 'Total rejection', 'kW']],
    x => { const s = x.PDC * (1 - C.Etn25 / x.E); return { stack: s, Q: s + x.PE + x.cond + x.comp - x.gas - x.rec }; });

  /* ============ CM Chapter 9 – compressed storage ============ */
  add('CM', '9.1', 9, 'Usable mass and state of charge', 'm_usable = V[ρ(p_max) − ρ(p_min)];  SOC = ρ/ρ(NWP, 15 °C)',
    [['V', 'Volume', 'm³', 26], ['pmax', 'Maximum pressure', 'bar', 250], ['pmin', 'Minimum pressure', 'bar', 25], ['T', 'Temperature', '°C', 15], ['NWP', 'Nominal working pressure', 'bar', 250]],
    [['mstored', 'Stored at p_max', 'kg'], ['mres', 'Residual at p_min', 'kg'], ['musable', 'Usable', 'kg'], ['frac', 'Usable fraction', '–'], ['SOC', 'SOC at p_max, T', '–']],
    x => { const T = K(x.T); const a = x.V * H2.rho(x.pmax, T), b = x.V * H2.rho(x.pmin, T); return { mstored: a, mres: b, musable: a - b, frac: (a - b) / a, SOC: H2.rho(x.pmax, T) / H2.rho(x.NWP, K(15)) }; });
  add('CM', '9.3', 9, 'Hoop stress and wall thickness', 'σθ = p·Dᵢ/(2t);  t = p_d·Dᵢ/(2fz − p_d)',
    [['pd', 'Design pressure', 'MPa', 45], ['pw', 'Working pressure', 'MPa', 30], ['Di', 'Inner diameter', 'm', 0.23], ['f', 'Allowable stress', 'MPa', 300], ['z', 'Joint efficiency', '–', 1]],
    [['t', 'Wall thickness', 'mm'], ['sig', 'Hoop stress at working p', 'MPa']],
    x => { const t = x.pd * x.Di / (2 * x.f * x.z - x.pd); return { t: t * 1000, sig: x.pw * x.Di / (2 * t) }; });
  add('CM', '9.4', 9, 'Cascade bank delivery', 'm_deliv = V_bank[ρ(p_bank) − ρ(p_eq)]',
    [['pb', 'Bank pressure', 'bar', 950], ['peq', 'Equalisation pressure', 'bar', 720], ['T', 'Temperature', '°C', 15], ['m', 'Mass required', 'kg', 48]],
    [['dr', 'Δρ', 'kg/m³'], ['V', 'Bank volume required', 'm³']],
    x => { const d = H2.rho(x.pb, K(x.T)) - H2.rho(x.peq, K(x.T)); return { dr: d, V: x.m / d }; });
  add('CM', '9.5', 9, 'Fast-fill temperature', 'm c_v dT/dt = ṁ(c_p T_in − c_v T) − hA(T − T_w);  T_ad = γ·T_in',
    [['Tin', 'Gas inlet temperature', '°C', -40], ['gamma', 'γ', '–', 1.405]],
    [['Tad', 'Adiabatic limit T_ad', '°C']], x => ({ Tad: x.gamma * K(x.Tin) - 273.15 }),
    'Upper bound for an empty tank filled adiabatically; heat transfer to the liner reduces it.');

  /* ============ CM Chapter 10 – compression ============ */
  add('CM', '10.1', 8, 'Isothermal work', 'w_iso = Z_m·R′·T₁·ln(p₂/p₁)',
    [['p1', 'Suction', 'bar', 1], ['p2', 'Discharge', 'bar', 350], ['T1', 'Suction temperature', '°C', 25], ['Zm', 'Mean Z', '–', 1]],
    [['w', 'w_iso', 'kWh/kg'], ['wMJ', 'w_iso', 'MJ/kg'], ['fLHV', 'Fraction of LHV', '–']],
    x => { const w = x.Zm * C.Rs * K(x.T1) * ln(x.p2 / x.p1); return { w: w / 3.6e6, wMJ: w / 1e6, fLHV: w / 3.6e6 / C.LHV }; });
  add('CM', '10.2', 8, 'Isentropic (single-stage) work', 'w_s = Z_m·γ/(γ−1)·R′T₁[(p₂/p₁)^((γ−1)/γ) − 1];  T₂ = T₁(p₂/p₁)^((γ−1)/γ)',
    [['p1', 'Suction', 'bar', 1], ['p2', 'Discharge', 'bar', 350], ['T1', 'Suction temperature', '°C', 25], ['Zm', 'Mean Z', '–', 1], ['gamma', 'γ', '–', 1.405]],
    [['w', 'w_s', 'kWh/kg'], ['T2', 'Discharge temperature', 'K']],
    x => { const e = (x.gamma - 1) / x.gamma; const pr = pow(x.p2 / x.p1, e); return { w: x.Zm * x.gamma / (x.gamma - 1) * C.Rs * K(x.T1) * (pr - 1) / 3.6e6, T2: K(x.T1) * pr }; });
  add('CM', '10.4', 8, 'Multistage compression', 'r = (p₂/p₁)^(1/N);  w_N = N·w_s(r);  T₂ = T₁ + T₁(r^0.288 − 1)/η_s',
    [['p1', 'Suction', 'bar', 30], ['p2', 'Discharge', 'bar', 200], ['N', 'Stages (0 = auto from r_max)', '–', 3], ['rmax', 'Max ratio per stage', '–', 2.3], ['T1', 'Suction temperature', '°C', 25], ['Zm', 'Mean Z (0 = per stage)', '–', 1.06], ['es', 'η_s', '–', 0.75], ['em', 'η_mech·η_motor', '–', 0.9], ['m', 'Flow', 'kg/h', 1923]],
    [['N', 'Stages', '–'], ['r', 'Stage ratio', '–'], ['wid', 'Ideal work', 'kWh/kg'], ['SEC', 'Electrical SEC', 'kWh/kg'], ['T2', 'Stage outlet', '°C'], ['P', 'Motor power (10.5)', 'kW'], ['Q', 'Intercooling', 'kW']],
    x => { const c = H2.compress(x.p1, x.p2, x.T1, { N: x.N, rmax: x.rmax, eta_s: x.es, eta_mech: x.em, eta_motor: 1, Zm: x.Zm > 0 ? x.Zm : null, mdot_kgh: x.m });
      return { N: c.N, r: c.r, wid: c.w_ideal_kWhkg, SEC: c.SEC_kWhkg, T2: c.T2_C, P: c.P_kW, Q: c.Q_cool_kW }; });
  add('CM', '10.5', 8, 'Compressor electrical power', 'P_el = ṁ·w_N/(η_s·η_mech·η_motor)',
    [['m', 'Flow', 'kg/h', 60], ['w', 'Ideal work w_N', 'kWh/kg', 1.58], ['es', 'η_s', '–', 0.72], ['em', 'η_mech', '–', 0.95], ['emot', 'η_motor', '–', 0.94]],
    [['P', 'Electrical power', 'kW'], ['SEC', 'Specific', 'kWh/kg'], ['Q', 'Cooling ≈ 0.9 P', 'kW']],
    x => { const s = x.w / (x.es * x.em * x.emot); return { P: x.m * s, SEC: s, Q: 0.9 * x.m * s }; });
  add('CM', '10.6', 8, 'Electrochemical compressor', 'E = (RT/2F)·ln(p₂/p₁) + j·ASR;  SEC = 26.59·E',
    [['T', 'Temperature', '°C', 60], ['p1', 'Inlet', 'bar', 1], ['p2', 'Outlet', 'bar', 700], ['j', 'Current density', 'A/cm²', 1], ['ASR', 'ASR', 'Ω cm²', 0.2]],
    [['Erev', 'Nernst voltage', 'V'], ['E', 'Cell voltage', 'V'], ['SEC0', 'Ideal SEC', 'kWh/kg'], ['SEC', 'SEC', 'kWh/kg']],
    x => { const e = C.R * K(x.T) / (2 * C.F) * ln(x.p2 / x.p1); const E = e + x.j * x.ASR; return { Erev: e, E, SEC0: C.kSEC * e, SEC: C.kSEC * E }; });

  /* ============ CM Chapter 11 – liquefaction ============ */
  add('CM', '11.1', 8, 'Minimum liquefaction work', 'w_min = T₀(s₀ − s_L) − (h₀ − h_L) ≈ 3.9 kWh/kg',
    [['T0', 'Ambient', 'K', 300], ['ds', 's₀ − s_L', 'kJ/(kg K)', 53.5], ['dh', 'h₀ − h_L', 'kJ/kg', 2000], ['SEC', 'Actual SEC', 'kWh/kg', 9], ['m', 'Capacity', 't/d', 100]],
    [['wmin', 'w_min', 'kWh/kg'], ['eex', 'Exergy efficiency', '–'], ['P', 'Plant power', 'MW'], ['fLHV', 'Fraction of LHV', '–']],
    x => { const w = (x.T0 * x.ds - x.dh) / 3600; return { wmin: w, eex: w / x.SEC, P: x.m * 1000 / 24 * x.SEC / 1000, fLHV: x.SEC / C.LHV }; },
    'Default Δs, Δh give ≈3.9 kWh/kg including ortho–para conversion (normal H₂ at 300 K, 1 bar to saturated para-LH₂).');
  add('CM', '11.2', 9, 'Boil-off rate', 'BOR = q″A·86 400/(m·Δh_vap);  A_sphere = 4.84·V^(2/3)',
    [['V', 'Tank volume', 'm³', 300], ['q', 'Heat flux', 'W/m²', 1.5], ['fill', 'Fill fraction', '–', 1], ['dh', 'Δh_vap', 'kJ/kg', 445.6]],
    [['A', 'Surface area', 'm²'], ['Q', 'Heat leak', 'W'], ['BOR', 'Boil-off rate', '%/d'], ['loss', 'Boil-off', 'kg/d']],
    x => { const A = 4.84 * pow(x.V, 2 / 3); const Q = x.q * A; const m = x.V * x.fill * C.rhoL; const l = Q * 86400 / (x.dh * 1000); return { A, Q, BOR: 100 * l / m, loss: l }; });
  add('CM', '11.3', 9, 'Dormancy of a closed LH₂ tank', 't ≈ m_L·c_p,L·ΔT_sat/Q̇_leak',
    [['m', 'Liquid mass', 'kg', 5], ['cp', 'c_p,L', 'kJ/(kg K)', 9.5], ['dT', 'ΔT_sat to relief', 'K', 8.6], ['Q', 'Heat leak', 'W', 2]],
    [['t_h', 'Dormancy', 'h'], ['t_d', 'Dormancy', 'd']],
    x => { const t = x.m * x.cp * 1000 * x.dT / x.Q; return { t_h: t / 3600, t_d: t / 86400 }; });
  add('CM', '11.4', 9, 'Flash loss', 'x_flash ≈ c_p,L·ΔT_sat/Δh_vap',
    [['cp', 'c_p,L', 'kJ/(kg K)', 9.5], ['dT', 'ΔT_sat', 'K', 5], ['dh', 'Δh_vap', 'kJ/kg', 445.6]], [['x', 'Flash fraction', '–']],
    x => ({ x: x.cp * x.dT / x.dh }));

  /* ============ CM Chapter 12 – carriers and caverns ============ */
  add('CM', '12.1', 9, "Van 't Hoff (metal hydride)", 'ln(p_eq/p°) = ΔH_abs/(RT) − ΔS_abs/R',
    [['dH', 'ΔH_abs', 'J/mol H₂', -30800], ['dS', 'ΔS_abs', 'J/(mol K)', -108], ['T', 'Temperature', '°C', 25]],
    [['lnp', 'ln(p_eq/p°)', '–'], ['p', 'Plateau pressure', 'bar']],
    x => { const l = x.dH / (C.R * K(x.T)) - x.dS / C.R; return { lnp: l, p: exp(l) }; });
  add('CM', '12.2', 9, 'Hydride heat', 'q_des = |ΔH_abs|/M_H₂;  fraction of LHV = |ΔH|/241.8',
    [['dH', '|ΔH_abs|', 'kJ/mol', 30.8], ['m', 'Hydrogen', 'kg', 5]],
    [['q', 'Heat of desorption', 'kWh/kg'], ['frac', 'Fraction of LHV', '–'], ['Q', 'Total heat', 'kWh']],
    x => { const qk = x.dH * 1000 / C.M_H2 / 3.6e6; return { q: qk, frac: x.dH / 241.8, Q: qk * x.m }; });
  add('CM', '12.3', 9, 'LOHC', 'm_LOHC = m_H₂/w_H₂;  q_dehyd = ΔH_dehyd/M_H₂',
    [['m', 'Hydrogen', 't', 1], ['w', 'H₂ capacity w_H₂', 'kg/kg', 0.062], ['dH', 'ΔH_dehyd', 'kJ/mol H₂', 65.4]],
    [['mL', 'Carrier mass', 't'], ['q', 'Dehydrogenation heat', 'kWh/kg'], ['frac', 'Fraction of LHV', '–']],
    x => { const q = x.dH * 1000 / C.M_H2 / 3.6e6; return { mL: x.m / x.w, q, frac: q / C.LHV }; });
  add('CM', '12.6', 9, 'Salt cavern working gas', 'm_working = V[ρ(p_max) − ρ(p_min)];  p_max ≈ 0.8·σ_lith',
    [['V', 'Cavern volume', 'm³', 500000], ['pmax', 'p_max', 'bar', 180], ['pmin', 'p_min', 'bar', 60], ['T', 'Temperature', '°C', 40], ['fill', 'Fill rate', 'kg/h', 1923]],
    [['mmax', 'Maximum inventory', 't'], ['mcush', 'Cushion gas', 't'], ['mw', 'Working gas', 't'], ['E', 'Working energy (LHV)', 'GWh'], ['tfill', 'Fill time', 'd']],
    x => { const T = K(x.T); const a = x.V * H2.rho(x.pmax, T) / 1000, b = x.V * H2.rho(x.pmin, T) / 1000; return { mmax: a, mcush: b, mw: a - b, E: (a - b) * C.LHV / 1000, tfill: (a - b) * 1000 / x.fill / 24 }; });

  /* ============ CM Chapter 13 – transport ============ */
  add('CM', '13.1', 10, 'Pipeline flow (isothermal)', 'p₁² − p₂² = (fL/D)(ṁ/A)²·Z_m R′T',
    [['L', 'Length', 'km', 100], ['D', 'Inner diameter', 'm', 0.4], ['f', 'Darcy friction factor', '–', 0.013], ['Zm', 'Mean Z', '–', 1.04], ['T', 'Temperature', '°C', 15], ['p1', 'Inlet pressure', 'bar', 70], ['p2', 'Outlet pressure', 'bar', 50]],
    [['m', 'Mass flow', 'kg/s'], ['P', 'Energy flow (LHV)', 'MW'], ['u1', 'Inlet velocity', 'm/s'], ['u2', 'Outlet velocity', 'm/s'], ['m_td', 'Daily', 't/d']],
    x => { const A = PI * x.D * x.D / 4; const G = sqrt((pow(x.p1 * 1e5, 2) - pow(x.p2 * 1e5, 2)) / (x.f * x.L * 1000 / x.D * x.Zm * C.Rs * K(x.T))); const m = G * A;
      return { m, P: m * C.LHV_MJ, u1: m / (A * H2.rho(x.p1, K(x.T))), u2: m / (A * H2.rho(x.p2, K(x.T))), m_td: m * 86.4 }; });
  add('CM', '13.2', 10, 'Colebrook friction factor', '1/√f = −2 log₁₀[ε/(3.7D) + 2.51/(Re√f)]',
    [['m', 'Mass flow', 'kg/s', 9.7], ['D', 'Diameter', 'm', 0.4], ['eps', 'Roughness', 'mm', 0.02], ['mu', 'Viscosity', 'µPa s', 8.9]],
    [['Re', 'Reynolds number', '–'], ['f', 'Friction factor', '–']],
    x => { const Re = 4 * x.m / (PI * x.D * x.mu * 1e-6); let f = 0.02; for (let i = 0; i < 50; i++) f = pow(-2 * log10(x.eps / 1000 / (3.7 * x.D) + 2.51 / (Re * sqrt(f))), -2); return { Re, f }; });
  add('CM', '13.3', 10, 'Truck logistics', 'n_trips = m_demand/m_usable;  e_diesel = 2d·c_fuel·LHV_d/m_usable',
    [['m', 'Demand', 'kg/d', 5000], ['mu', 'Usable payload', 'kg', 1000], ['d', 'One-way distance', 'km', 200], ['cyc', 'Trailer cycle time', 'h', 10], ['c', 'Diesel consumption', 'L/100 km', 35], ['LHVd', 'Diesel LHV', 'MJ/L', 35.9], ['CO2', 'CO₂ of diesel', 'kg/L', 2.65]],
    [['trips', 'Trips per day', '–'], ['trailers', 'Trailers (incl. cycle)', '–'], ['e', 'Diesel energy', 'MJ/kg H₂'], ['frac', 'Fraction of LHV', '–'], ['co2', 'CO₂', 'kg/kg H₂']],
    x => { const t = Math.ceil(x.m / x.mu); const L = 2 * x.d * x.c / 100; return { trips: t, trailers: Math.ceil(t * x.cyc / 24) + 1, e: L * x.LHVd / x.mu, frac: L * x.LHVd / x.mu / C.LHV_MJ, co2: L * x.CO2 / x.mu }; });

  /* ============ CM Chapter 14 – renewables ============ */
  add('CM', '14.1', 5, 'PV output', 'P_PV = P_p(G/G_STC)[1 − γ_T(T_cell − 25)]·η_inv·(1 − ℓ)',
    [['Pp', 'Peak power', 'kWp', 1000], ['G', 'Irradiance (POA)', 'W/m²', 900], ['Ta', 'Ambient temperature', '°C', 30], ['NOCT', 'NOCT', '°C', 45], ['gT', 'Temperature coefficient γ_T', '%/K', 0.35], ['einv', 'η_inv', '–', 0.98], ['l', 'Other losses ℓ', '–', 0.1]],
    [['Tcell', 'Cell temperature (DM 3.3)', '°C'], ['P', 'AC output', 'kW']],
    x => { const Tc = x.Ta + (x.NOCT - 20) / 800 * x.G; return { Tcell: Tc, P: x.Pp * x.G / 1000 * (1 - x.gT / 100 * (Tc - 25)) * x.einv * (1 - x.l) }; });
  add('CM', '14.2', 5, 'PV yield and capacity factor', 'E = P_p·Y_spec;  CF = Y_spec/8760',
    [['Pp', 'Peak power', 'MWp', 30], ['Y', 'Specific yield', 'kWh/kWp/a', 1050]], [['E', 'Annual energy', 'GWh/a'], ['CF', 'Capacity factor', '–']],
    x => ({ E: x.Pp * x.Y / 1000, CF: x.Y / 8760 }));
  add('CM', '14.3', 5, 'Wind power', 'P = ½ρAv³·C_p·η;  C_p ≤ 16/27 = 0.593',
    [['rho', 'Air density', 'kg/m³', 1.225], ['D', 'Rotor diameter', 'm', 150], ['v', 'Wind speed', 'm/s', 10], ['Cp', 'C_p', '–', 0.45], ['eta', 'Drive-train η', '–', 0.94]],
    [['Pwind', 'Power in the wind', 'MW'], ['P', 'Electrical power', 'MW'], ['Pbetz', 'Betz limit', 'MW']],
    x => { const A = PI * x.D * x.D / 4; const Pw = 0.5 * x.rho * A * pow(x.v, 3) / 1e6; return { Pwind: Pw, P: Pw * x.Cp * x.eta, Pbetz: Pw * 16 / 27 }; });
  add('CM', '14.4', 5, 'Weibull distribution and turbine CF', 'f(v) = (k/c)(v/c)^(k−1) e^(−(v/c)^k);  CF = ∫P(v)f(v)dv / P_r',
    [['vm', 'Mean wind speed (hub)', 'm/s', 7.5], ['k', 'Weibull shape k', '–', 2], ['vin', 'Cut-in', 'm/s', 3], ['vr', 'Rated speed', 'm/s', 12], ['vout', 'Cut-out', 'm/s', 25], ['Pr', 'Farm rating', 'MW', 50]],
    [['c', 'Weibull scale c', 'm/s'], ['CF', 'Gross capacity factor', '–'], ['E', 'Annual energy', 'GWh/a'], ['FLH', 'Full-load hours', 'h']],
    x => { const c = x.vm / H2.gamma(1 + 1 / x.k); let s = 0; const dv = 0.05; for (let v = dv / 2; v < 40; v += dv) { const f = x.k / c * pow(v / c, x.k - 1) * exp(-pow(v / c, x.k)); s += H2.turbinePU(v, { v_in: x.vin, v_rated: x.vr, v_out: x.vout }) * f * dv; }
      return { c, CF: s, E: s * x.Pr * 8.76, FLH: s * 8760 }; });
  add('CM', '14.5', 5, 'Electrolyser capacity factor on renewables', 'CF_el = Σ min(P_RE, P_el)·1[P_RE ≥ P_min]/(8760·P_el)',
    [['Pre', 'RE capacity / electrolyser rating', '–', 1.8], ['cfre', 'RE capacity factor', '–', 0.25], ['pv', 'PV share of RE capacity (0–1)', '–', 1], ['minl', 'Minimum load', '–', 0.1], ['seed', 'Weather seed', '–', 1]],
    [['CF', 'Electrolyser CF', '–'], ['curt', 'Curtailed share', '–']],
    x => { const W = H2.weather({ lat: 30, GHI_annual: 2000, v_mean: 8, seed: x.seed }); const n = 8760; let pv = [], wd = []; let spv = 0, swd = 0;
      for (let h = 0; h < n; h++) { pv[h] = H2.pvPower(W.ghi[h] * 1.2, W.tam[h], {}); wd[h] = H2.turbinePU(W.ws[h]); spv += pv[h]; swd += wd[h]; }
      let E = 0, Re = 0; const kp = x.pv * x.cfre * n / spv, kw = (1 - x.pv) * x.cfre * n / Math.max(swd, 1e-9);
      for (let h = 0; h < n; h++) { const p = x.Pre * (kp * pv[h] + kw * wd[h]); Re += p; if (p >= x.minl) E += Math.min(p, 1); }
      return { CF: E / n, curt: 1 - E / Re }; },
    'Uses a synthetic hourly year (same generator as the hourly simulation) normalised to the given RE capacity factor.');
  add('CM', '14.7', 9, 'Buffer storage from production and demand', 'm_buffer = max S(t) − min S(t),  S = ∫(ṁ_prod − ṁ_dem)dt',
    [['prod', 'Production profile (list, kg/h)', 'kg/h', '0,0,0,0,0,0,50,150,250,300,320,330,330,320,300,250,150,50,0,0,0,0,0,0'], ['dem', 'Demand (0 = flat mean)', 'kg/h', 0]],
    [['mean', 'Mean production', 'kg/h'], ['buffer', 'Buffer (daily cycle)', 'kg']],
    x => { const p = list(x.prod); const mean = p.reduce((a, b) => a + b, 0) / p.length; const d = x.dem > 0 ? x.dem : mean; let S = 0, mx = 0, mn = 0; p.forEach(v => { S += v - d; mx = Math.max(mx, S); mn = Math.min(mn, S); }); return { mean, buffer: mx - mn }; });

  /* ============ CM Chapter 15/16 – Power-to-X and end use ============ */
  add('CM', '15.2', 11, 'Ammonia synthesis balance', 'm_H₂ = 0.1776·m_NH₃;  m_N₂ = 0.822·m_NH₃;  ΔH = −2.71 MJ/kg',
    [['mNH3', 'Ammonia', 't/h', 9.75], ['eASU', 'ASU energy', 'kWh/kg N₂', 0.12], ['eloop', 'Loop energy', 'MWh/t NH₃', 0.55], ['SEC', 'Electrolysis SEC', 'kWh/kg H₂', 52]],
    [['mH2', 'Hydrogen', 't/h'], ['mN2', 'Nitrogen', 't/h'], ['Q', 'Reaction heat', 'MW'], ['PASU', 'ASU power', 'MW'], ['E', 'Total electricity', 'MWh/t NH₃'], ['eta', 'Chain efficiency (LHV NH₃ 5.17 MWh/t)', '–']],
    x => { const h = 0.1776 * x.mNH3, n = 0.822 * x.mNH3; const E = 0.1776 * x.SEC + 0.822 * x.eASU + x.eloop; return { mH2: h, mN2: n, Q: x.mNH3 * 2.71 / 3.6, PASU: n * x.eASU, E, eta: 5.17 / E }; });
  add('CM', '15.5', 11, 'Methanol synthesis', 'm_H₂ = 0.189·m_CH₃OH;  m_CO₂ = 1.373·m_CH₃OH',
    [['mH2', 'Hydrogen', 'kg/h', 1000], ['SEC', 'SEC', 'kWh/kg', 52], ['ecap', 'CO₂ capture', 'MWh/t CO₂', 0.5], ['esyn', 'Synthesis', 'MWh/t MeOH', 0.6]],
    [['mMeOH', 'Methanol', 'kg/h'], ['mCO2', 'CO₂', 'kg/h'], ['mH2O', 'Water produced', 'kg/h'], ['Q', 'Reaction heat', 'MW'], ['E', 'Electricity', 'MWh/t'], ['eta', 'Chain efficiency (LHV 5.53 MWh/t)', '–']],
    x => { const m = x.mH2 / 0.189; const E = 0.189 * x.SEC + 1.373 * x.ecap + x.esyn; return { mMeOH: m, mCO2: 1.373 * m, mH2O: 0.562 * m, Q: m * 1.54 / 3600, E, eta: 5.53 / E }; });
  add('CM', '15.6', 11, 'Methanation and Fischer–Tropsch', 'm_H₂ = 0.503·m_CH₄;  m_H₂ = 0.431·m_FT',
    [['mH2', 'Hydrogen', 't/a', 1000]], [['mCH4', 'Synthetic methane', 't/a'], ['mCO2m', 'CO₂ for methane (2.74)', 't/a'], ['mFT', 'FT liquids', 't/a'], ['mCO2f', 'CO₂ for FT (3.14)', 't/a']],
    x => { const a = x.mH2 / 0.503, b = x.mH2 / 0.431; return { mCH4: a, mCO2m: 2.74 * a, mFT: b, mCO2f: 3.14 * b }; });
  add('CM', '15.8', 11, 'Direct reduction of iron', 'm_H₂,st = 54 kg per t Fe;  ΔH = 0.88 MJ/kg Fe',
    [['mFe', 'Iron', 't/a', 1000000], ['lambda', 'H₂ excess (utilisation)', '–', 1.5], ['SEC', 'SEC', 'kWh/kg', 52]],
    [['mH2', 'Hydrogen consumed', 't/a'], ['Q', 'Reaction heat', 'GWh/a'], ['E', 'Electrolysis', 'TWh/a'], ['CO2', 'CO₂ avoided vs BF-BOF (1.8 t/t)', 'Mt/a']],
    x => { const h = x.mFe * 0.054; return { mH2: h, Q: x.mFe * 0.88 / 3.6 / 1000, E: h * x.SEC / 1e6, CO2: x.mFe * 1.8 / 1e6 }; },
    'Hydrogen is recycled; the λ input is kept for the gas circulation estimate (circulated = λ × consumed).');
  add('CM', '16.2', 11, 'Fuel-cell efficiency and consumption', 'η_LHV = V_cell·η_fuel/1.253;  consumption = 1000/(26.59·V_cell·η_fuel) g/kWh',
    [['V', 'Cell voltage', 'V', 0.7], ['ef', 'Fuel utilisation', '–', 0.98], ['P', 'Stack (gross) power', 'kW', 100], ['kBoP', 'BoP share', '–', 0.12], ['j', 'Current density', 'A/cm²', 1], ['A', 'Cell area', 'cm²', 300]],
    [['eta', 'Stack η_LHV', '–'], ['etas', 'System η_LHV', '–'], ['g', 'Stack consumption', 'g/kWh'], ['m', 'H₂ flow', 'kg/h'], ['N', 'Cells', '–'], ['I', 'Current', 'A'], ['Pnet', 'Net power', 'kW']],
    x => { const e = x.V * x.ef / 1.253; const m = x.P / (e * C.LHV); return { eta: e, etas: e * (1 - x.kBoP), g: 1000 / (C.kSEC * x.V * x.ef), m, N: Math.round(x.P * 1000 / (x.V * x.j * x.A)), I: x.j * x.A, Pnet: x.P * (1 - x.kBoP) }; });
  add('CM', '16.4', 11, 'Combustion flows', 'ṁ_air = 34.3·λ·ṁ_H₂;  ṁ_H₂O = 8.94·ṁ_H₂',
    [['m', 'Hydrogen', 'kg/h', 60], ['lambda', 'Air ratio λ', '–', 2]], [['air', 'Air', 'kg/h'], ['H2O', 'Water produced', 'kg/h'], ['Q', 'Heat release (LHV)', 'kW']],
    x => ({ air: 34.3 * x.lambda * x.m, H2O: 8.94 * x.m, Q: x.m * C.LHV }));
  add('CM', '16.5', 11, 'Wobbe index of H₂–CH₄ blends', 'W = HHV_vol/√d;  HHV_blend = Σxᵢ HHVᵢ;  d_blend = Σxᵢdᵢ',
    [['x', 'H₂ volume fraction', '–', 0.2], ['HHVg', 'HHV natural gas', 'MJ/Nm³', 39.82], ['dg', 'Relative density NG', '–', 0.554]],
    [['HHV', 'Blend HHV', 'MJ/Nm³'], ['d', 'Blend density', '–'], ['W', 'Wobbe index', 'MJ/Nm³'], ['share', 'H₂ energy share', '–'], ['flow', 'Volume flow increase', '–']],
    x => { const Hb = x.x * 12.75 + (1 - x.x) * x.HHVg; const d = x.x * 0.0696 + (1 - x.x) * x.dg; return { HHV: Hb, d, W: Hb / sqrt(d), share: x.x * 12.75 / Hb, flow: x.HHVg / Hb }; });

  /* ============ CM Chapter 17 – economics ============ */
  add('CM', '17.1', 12, 'Capital recovery factor', 'CRF = r(1 + r)ⁿ/[(1 + r)ⁿ − 1]',
    [['r', 'Discount rate (WACC)', '–', 0.07], ['n', 'Lifetime', 'a', 25], ['I', 'Investment', 'MEUR', 100]],
    [['CRF', 'CRF', '1/a'], ['A', 'Annuity', 'MEUR/a'], ['AF', 'Annuity factor 1/CRF', 'a']],
    x => { const c = H2.CRF(x.r, x.n); return { CRF: c, A: c * x.I, AF: 1 / c }; });
  add('CM', '17.3', 12, 'Levelised cost of hydrogen (simple)', 'LCOH ≈ [C_inv(CRF + f_OM) + C_stack]/(8760·CF/SEC) + p_el·SEC + c_water',
    [['Cinv', 'Specific CAPEX', 'EUR/kW', 1500], ['r', 'WACC', '–', 0.07], ['n', 'Life', 'a', 25], ['fOM', 'Fixed O&M', '1/a', 0.03], ['CF', 'Capacity factor', '–', 0.5], ['SEC', 'SEC', 'kWh/kg', 52], ['sf', 'Stack cost share', '–', 0.35], ['sl', 'Stack life', 'h', 80000], ['pel', 'Electricity price', 'EUR/MWh', 50], ['cw', 'Water cost', 'EUR/kg H₂', 0.05]],
    [['CRF', 'CRF', '1/a'], ['mkW', 'H₂ per kW', 'kg/(kW a)'], ['Cst', 'Stack cost', 'EUR/(kW a)'], ['cap', 'Capital + O&M + stacks', 'EUR/kg'], ['el', 'Electricity', 'EUR/kg'], ['LCOH', 'LCOH', 'EUR/kg']],
    x => { const c = H2.CRF(x.r, x.n); const m = 8760 * x.CF / x.SEC; const Cs = x.sf * x.Cinv / (x.sl / (8760 * x.CF)); const cap = (x.Cinv * (c + x.fOM) + Cs) / m; const el = x.pel * x.SEC / 1000; return { CRF: c, mkW: m, Cst: Cs, cap, el, LCOH: cap + el + x.cw }; });
  add('CM', '17.5', 12, 'NPV and payback', 'NPV = −I₀ + Σ(R_t − O_t)/(1 + r)^t;  t_pb = I₀/(R − O)',
    [['I0', 'Investment', 'MEUR', 150], ['m', 'Hydrogen sold', 't/a', 8423], ['price', 'Price', 'EUR/kg', 6], ['E', 'Electricity', 'GWh/a', 438], ['pel', 'Electricity price', 'EUR/MWh', 50], ['OM', 'Fixed O&M', 'MEUR/a', 4.5], ['r', 'Discount rate', '–', 0.07], ['n', 'Life', 'a', 25]],
    [['CFa', 'Annual cash flow', 'MEUR/a'], ['NPV', 'NPV', 'MEUR'], ['IRR', 'IRR', '–'], ['pb', 'Simple payback', 'a']],
    x => { if (!(x.n >= 1 && x.n <= 100)) throw new RangeError('The life must lie between 1 and 100 years.');
      const cf = x.m * x.price / 1000 - x.E * x.pel / 1000 - x.OM;
      const af = r => (Math.abs(r) < 1e-12 ? x.n : (1 - pow(1 + r, -x.n)) / r);          // annuity factor Σ 1/(1+r)^t, t = 1…n
      const npv = r => -x.I0 + cf * af(r);
      let lo = -0.9, hi = 1; for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (npv(mid) > 0) lo = mid; else hi = mid; } return { CFa: cf, NPV: npv(x.r), IRR: lo, pb: x.I0 / cf }; });
  add('CM', '17.6', 12, 'Levelised cost of ammonia', 'LCOA = 177.6·LCOH + C_syn(CRF + f_OM)/CF + e_syn·p_el',
    [['LCOH', 'LCOH', 'EUR/kg', 5], ['Csyn', 'Synthesis CAPEX', 'EUR per t/a', 1000], ['CRF', 'CRF', '1/a', 0.0858], ['fOM', 'Fixed O&M', '1/a', 0.03], ['CF', 'Synthesis CF', '–', 1], ['esyn', 'Synthesis electricity', 'MWh/t', 0.65], ['pel', 'Electricity price', 'EUR/MWh', 50]],
    [['h', 'Hydrogen part', 'EUR/t'], ['cap', 'Synthesis capital', 'EUR/t'], ['el', 'Electricity', 'EUR/t'], ['LCOA', 'LCOA', 'EUR/t NH₃']],
    x => { const h = 177.6 * x.LCOH, c = x.Csyn * (x.CRF + x.fOM) / x.CF, e = x.esyn * x.pel; return { h, cap: c, el: e, LCOA: h + c + e }; });
  add('CM', '17.8', 12, 'Learning curve', 'C(Q) = C₀(Q/Q₀)^b,  b = ln(1 − LR)/ln 2',
    [['C0', 'Initial cost', 'EUR/kW', 1500], ['Q0', 'Initial capacity', 'GW', 10], ['Q', 'Future capacity', 'GW', 160], ['LR', 'Learning rate', '–', 0.18]],
    [['b', 'Exponent b', '–'], ['C', 'Future cost', 'EUR/kW'], ['dbl', 'Doublings', '–']],
    x => { const b = ln(1 - x.LR) / ln(2); return { b, C: x.C0 * pow(x.Q / x.Q0, b), dbl: log10(x.Q / x.Q0) / log10(2) }; });

  /* ============ CM Chapter 18 – environment ============ */
  add('CM', '18.1', 13, 'Carbon intensity of hydrogen', 'CI_H₂ = CI_el·SEC/1000 + CI_embodied',
    [['CIel', 'Electricity CI', 'g CO₂e/kWh', 50], ['SEC', 'SEC', 'kWh/kg', 52], ['emb', 'Embodied', 'kg/kg', 0.1], ['thr', 'Threshold (RFNBO 3.38)', 'kg/kg', 3.38]],
    [['CI', 'Carbon intensity', 'kg CO₂e/kg'], ['CImax', 'Max electricity CI for threshold', 'g/kWh'], ['ok', 'Meets threshold (1 = yes)', '–']],
    x => { const ci = x.CIel * x.SEC / 1000 + x.emb; return { CI: ci, CImax: (x.thr - x.emb) * 1000 / x.SEC, ok: ci <= x.thr ? 1 : 0 }; });
  add('CM', '18.2', 13, 'CO₂ abatement cost', 'c_abat = (LCOH_green − LCOH_ref)/[(CI_ref − CI_green)/1000]',
    [['Lg', 'LCOH green', 'EUR/kg', 5.05], ['Lr', 'LCOH reference (grey)', 'EUR/kg', 1.82], ['CIr', 'CI reference', 'kg/kg', 9.5], ['CIg', 'CI green', 'kg/kg', 1], ['m', 'Production', 't/a', 8423]],
    [['c', 'Abatement cost', 'EUR/t CO₂'], ['dCO2', 'CO₂ avoided', 't/a']],
    x => ({ c: (x.Lg - x.Lr) / ((x.CIr - x.CIg) / 1000), dCO2: x.m * (x.CIr - x.CIg) }));
  add('CM', '18.3', 13, 'Leakage emissions', 'CI_leak = ℓ/(1 − ℓ)·GWP_H₂,  GWP100 ≈ 11.6',
    [['l', 'Leakage fraction', '–', 0.01], ['GWP', 'GWP100 of H₂', '–', 11.6], ['CI', 'Production CI', 'kg/kg', 1]],
    [['leak', 'Leakage CI', 'kg CO₂e/kg'], ['tot', 'Delivered CI', 'kg CO₂e/kg']],
    x => { const l = x.l / (1 - x.l) * x.GWP; return { leak: l, tot: x.CI / (1 - x.l) + l }; });

  /* ============ CM Chapter 19 – safety ============ */
  add('CM', '19.1', 14, 'Choked release rate', 'ṁ = C_d·A·√(γρ₀p₀(2/(γ+1))^((γ+1)/(γ−1))) ≈ 0.049·C_d·d²[mm]·p[bar]/√Z g/s',
    [['d', 'Hole diameter', 'mm', 1], ['p', 'Pressure', 'bar', 700], ['T', 'Temperature', '°C', 20], ['Cd', 'Discharge coefficient', '–', 0.85]],
    [['rho0', 'Stagnation density', 'kg/m³'], ['m', 'Release rate', 'g/s'], ['mapprox', 'Short-cut (0.049 C_d d² p/√Z)', 'g/s']],
    x => { const g = C.gamma, r0 = H2.rho(x.p, K(x.T)); const A = PI * pow(x.d / 1000, 2) / 4; const m = x.Cd * A * sqrt(g * r0 * x.p * 1e5 * pow(2 / (g + 1), (g + 1) / (g - 1)));
      return { rho0: r0, m: m * 1000, mapprox: 0.049 * x.Cd * x.d * x.d * x.p / sqrt(H2.Z(x.p, K(x.T))) }; });
  add('CM', '19.2', 14, 'Blow-down of a vessel', 'm(t) = m₀·e^(−t/τ),  τ = m₀/ṁ₀',
    [['V', 'Volume', 'm³', 0.15], ['p', 'Initial pressure', 'bar', 700], ['T', 'Temperature', '°C', 20], ['m0dot', 'Initial release', 'g/s', 24.2], ['pend', 'Final pressure', 'bar', 2]],
    [['m0', 'Initial inventory', 'kg'], ['tau', 'Time constant τ', 's'], ['t', 'Time to p_end (≈ m ratio)', 'min']],
    x => { const m0 = x.V * H2.rho(x.p, K(x.T)); const tau = m0 / (x.m0dot / 1000); const me = x.V * H2.rho(x.pend, K(x.T)); return { m0, tau, t: tau * ln(m0 / me) / 60 }; });
  add('CM', '19.3', 14, 'Ventilation for dilution', 'V̇_air = ṁ_H₂/(ρ_H₂·x_target)',
    [['m', 'Leak rate', 'g/s', 1], ['rho', 'H₂ density', 'kg/m³', 0.082], ['x', 'Target concentration', '–', 0.01], ['V', 'Room volume', 'm³', 65]],
    [['Q', 'Air flow', 'm³/s'], ['Qh', 'Air flow', 'm³/h'], ['ACH', 'Air changes per hour', '1/h']],
    x => { const q = x.m / 1000 / (x.rho * x.x); return { Q: q, Qh: q * 3600, ACH: q * 3600 / x.V }; });
  add('CM', '19.5', 14, 'Jet extent and flame length', 'x_LFL ≈ 490·d_eff,  d_eff = d√(ρ_throat/ρ_atm);  L_f = 76(ṁd)^0.347',
    [['d', 'Hole diameter', 'mm', 1], ['rho0', 'Stagnation density', 'kg/m³', 40.2], ['m', 'Release rate', 'kg/s', 0.0242]],
    [['deff', 'Notional diameter', 'mm'], ['xLFL', 'Distance to LFL', 'm'], ['Lf', 'Flame length', 'm']],
    x => { const de = x.d * sqrt(0.634 * x.rho0 / C.rho_atm_H2); return { deff: de, xLFL: 490 * de / 1000, Lf: 76 * pow(x.m * x.d / 1000, 0.347) }; });
  add('CM', '19.6', 14, 'Thermal radiation of a jet flame', 'q″ = χ_r·τ_a·ṁ·LHV/(4πr²)',
    [['chi', 'Radiant fraction χ_r', '–', 0.1], ['tau', 'Transmissivity τ_a', '–', 0.8], ['m', 'Release rate', 'kg/s', 0.0242], ['q', 'Flux threshold', 'kW/m²', 4.7]],
    [['Prad', 'Radiated power', 'kW'], ['r', 'Distance to threshold', 'm']],
    x => { const P = x.chi * x.m * C.LHV_MJ * 1000; return { Prad: P, r: sqrt(x.tau * P / (4 * PI * x.q)) }; });
  add('CM', '19.8', 14, 'TNT-equivalence blast', 'W = η_y·m·LHV/4.68;  Z = R/W^⅓;  Δp ≈ 98(0.95/Z + 3.9/Z² + 13/Z³) kPa',
    [['m', 'Flammable mass', 'kg', 5], ['ey', 'Yield η_y', '–', 0.1], ['R', 'Distance', 'm', 30], ['dp', 'Overpressure threshold', 'kPa', 10]],
    [['W', 'TNT equivalent', 'kg'], ['Z', 'Scaled distance', 'm/kg^⅓'], ['p', 'Overpressure at R', 'kPa'], ['Rdp', 'Distance to threshold', 'm']],
    x => { const W = x.ey * x.m * C.LHV_MJ / 4.68; const f = Z => 98 * (0.95 / Z + 3.9 / (Z * Z) + 13 / (Z * Z * Z)); const Z = x.R / Math.cbrt(W);
      let lo = 0.5, hi = 500; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (f(m) > x.dp) lo = m; else hi = m; } return { W, Z, p: f(Z), Rdp: lo * Math.cbrt(W) }; });
  add('CM', '19.9', 14, 'Relief valve sizing (API 520)', 'A[mm²] = 13 160·W/(C·K_d·P₁·K_b·K_c)·√(TZ/M),  C = 356',
    [['W', 'Relief rate', 'kg/h', 3600], ['P1', 'Relieving pressure', 'kPa(a)', 44100], ['Kd', 'K_d', '–', 0.975], ['T', 'Temperature', 'K', 300], ['Z', 'Z', '–', 1.27], ['M', 'Molar mass', 'g/mol', 2.016]],
    [['A', 'Orifice area', 'mm²'], ['d', 'Equivalent diameter', 'mm']],
    x => { const A = 13160 * x.W / (356 * x.Kd * x.P1) * sqrt(x.T * x.Z / x.M); return { A, d: sqrt(4 * A / PI) }; });

  /* ============ CM Chapter 20 – materials ============ */
  add('CM', '20.1', 14, 'Pipeline wall (ASME B31.12)', 't = pD/(2·S·F·E·T·H_f)',
    [['p', 'Design pressure', 'MPa', 7], ['D', 'Outside diameter', 'mm', 400], ['S', 'SMYS', 'MPa', 359], ['F', 'Design factor', '–', 0.5], ['E', 'Joint factor', '–', 1], ['T', 'Temperature factor', '–', 1], ['Hf', 'Material performance factor', '–', 0.874]],
    [['t', 'Wall thickness', 'mm'], ['steel', 'Steel mass', 't/km']],
    x => { const t = x.p * x.D / (2 * x.S * x.F * x.E * x.T * x.Hf); return { t, steel: PI * (x.D - t) / 1000 * t / 1000 * 1000 * 7.85 }; });
  add('CM', '20.2', 14, 'Permeation through metals', 'J = Φ_m(√p₁ − √p₂)/δ',
    [['Phi', 'Permeability Φ_m', 'mol/(m s MPa^½)', 1e-11], ['p1', 'p₁', 'MPa', 7], ['p2', 'p₂', 'MPa', 0], ['d', 'Wall thickness', 'mm', 10], ['D', 'Pipe diameter', 'm', 0.4]],
    [['J', 'Flux', 'mol/(m² s)'], ['loss', 'Loss per km', 'kg/a']],
    x => { const J = x.Phi * (sqrt(x.p1) - sqrt(x.p2)) / (x.d / 1000); return { J, loss: J * PI * x.D * 1000 * C.M_H2 * 3.1536e7 }; });
  add('CM', '20.3', 14, 'Permeation through polymers', 'J = Φ_p(p₁ − p₂)/δ',
    [['Phi', 'Permeability Φ_p', 'mol/(m s MPa)', 1e-12], ['p1', 'p₁', 'MPa', 70], ['p2', 'p₂', 'MPa', 0], ['d', 'Liner thickness', 'mm', 5], ['A', 'Liner area', 'm²', 1.2]],
    [['J', 'Flux', 'mol/(m² s)'], ['NmL', 'Permeation', 'NmL/min'], ['NmLL', 'per litre (V = 120 L)', 'NmL/(min L)']],
    x => { const J = x.Phi * (x.p1 - x.p2) / (x.d / 1000); const q = J * x.A * 22414 * 60; return { J, NmL: q, NmLL: q / 120 }; });

  /* ======================================================================
     DESIGN MANUAL equations
     ====================================================================== */
  add('DM', '1.1–1.5', 15, 'Sizing chain from demand to resources', 'm_H₂ = m_product/yield;  P_ely = m_H₂·SEC/FLH;  P_RE = P_ely·FLH(1+c)/FLH_RE;  V̇_raw = ṁ_H₂w_DI/Y_RO;  A = a_PV P_PV + a_wind P_wind + a_plant P_ely',
    [['mprod', 'Product demand', 't/a', 45000], ['yield', 'Product per kg H₂ (NH₃: 0.178/0.97; 1 = pure H₂)', 'kg H₂/kg', 0.1835], ['avail', 'Availability', '–', 0.95], ['SEC', 'SEC', 'kWh/kg', 52], ['FLH', 'Electrolyser FLH', 'h', 4400], ['c', 'Curtailment', '–', 0.15], ['FLHRE', 'RE full-load hours', 'h', 2600], ['aux', 'Auxiliaries', 'MW', 6], ['wDI', 'DI water', 'L/kg', 10.5], ['Y', 'RO recovery', '–', 0.38], ['aPV', 'Land PV', 'ha/MWp', 1.4], ['PVshare', 'PV share of RE capacity', '–', 0.75]],
    [['mH2', 'Hydrogen target', 't/a'], ['Pely', 'Electrolyser', 'MW'], ['mdot', 'Full-load H₂', 'kg/h'], ['Ere', 'RE generation', 'GWh/a'], ['Pre', 'RE capacity', 'MW'], ['Vraw', 'Raw water at full load', 'm³/h'], ['land', 'Land (PV + plant)', 'ha']],
    x => { const m = x.mprod * x.yield / x.avail; const P = m * 1000 * x.SEC / x.FLH / 1000; const E = (P * x.FLH + x.aux * 8760) / 1000 / (1 - x.c); const Pre = E * 1000 / x.FLHRE; const md = P * 1000 / x.SEC;
      return { mH2: m, Pely: P, mdot: md, Ere: E, Pre, Vraw: md * x.wDI / 1000 / x.Y, land: x.aPV * Pre * x.PVshare + 0.06 * P }; });
  add('DM', '2.1', 15, 'Electrochemical vs mechanical compression', 'ΔE_Nernst = (RT/2F)·ln(p_H₂√p_O₂/p°^1.5);  ΔSEC_el = 26.59·ΔE + ΔSEC_crossover',
    [['T', 'Temperature', '°C', 80], ['pH2', 'p_H₂', 'bar', 30], ['pO2', 'p_O₂', 'bar', 30], ['dcross', 'ΔSEC crossover', 'kWh/kg', 0], ['wmech', 'Mechanical alternative 1→30 bar', 'kWh/kg', 1.7]],
    [['dE', 'ΔE_Nernst', 'V'], ['dSEC', 'ΔSEC electrochemical', 'kWh/kg'], ['saving', 'Saving vs mechanical', 'kWh/kg']],
    x => { const dE = C.R * K(x.T) / (2 * C.F) * ln(x.pH2 * sqrt(x.pO2)); const d = C.kSEC * dE + x.dcross; return { dE, dSEC: d, saving: x.wmech - d }; });
  add('DM', '2.3', 15, 'System availability and redundancy', 'A_sys = ΠAᵢ;  A_N+1 = 1 − (1 − A)²;  A_2oo3 = 3A² − 2A³;  Aᵢ = MTBF/(MTBF + MTTR) (2.4)',
    [['A', 'Subsystem availabilities (list)', '–', '0.997,0.99,0.99,0.97,0.97,0.985,0.995,0.96,0.96,0.998'], ['Au', 'Single unit A (redundancy test)', '–', 0.96], ['MTBF', 'MTBF', 'h', 4000], ['MTTR', 'MTTR', 'h', 48]],
    [['Asys', 'System availability', '–'], ['AN1', 'N+1 (1 of 2)', '–'], ['A2oo3', '2 of 3', '–'], ['Ai', 'A from MTBF/MTTR', '–']],
    x => ({ Asys: list(x.A).reduce((a, b) => a * b, 1), AN1: 1 - pow(1 - x.Au, 2), A2oo3: 3 * x.Au * x.Au - 2 * pow(x.Au, 3), Ai: x.MTBF / (x.MTBF + x.MTTR) }));
  add('DM', '3.1', 5, 'Resource exceedance (P50 → P90)', 'H_P90 = H_P50(1 − 1.282σ_tot),  σ_tot = √(σ²_inter + σ²_data + σ²_model)',
    [['E', 'P50 energy', 'GWh/a', 32.3], ['si', 'σ interannual', '–', 0.045], ['sd', 'σ data', '–', 0.035], ['sm', 'σ model', '–', 0.03], ['z', 'Quantile (1.282 P90, 1.645 P95)', '–', 1.282]],
    [['s', 'σ_tot', '–'], ['P90', 'P90 energy', 'GWh/a']],
    x => { const s = sqrt(x.si * x.si + x.sd * x.sd + x.sm * x.sm); return { s, P90: x.E * (1 - x.z * s) }; });
  add('DM', '3.2', 5, 'PV energy yield and performance ratio', 'E_AC = P_DC,STC·(H_POA/G_STC)·PR,  PR = Π(1 − ℓᵢ),  Y = E_AC/P_DC',
    [['GHI', 'GHI', 'kWh/(m² a)', 1150], ['tr', 'Transposition gain H_POA/GHI', '–', 1.12], ['losses', 'Losses ℓᵢ (list)', '–', '0.02,0.05,0.02,0.015,0.02,0.03,0.01,0.03'], ['P', 'DC capacity', 'MWp', 30]],
    [['PR', 'Performance ratio', '–'], ['H', 'H_POA', 'kWh/m²'], ['Y', 'Specific yield', 'kWh/kWp'], ['E', 'Annual energy', 'GWh'], ['CF', 'Capacity factor', '–']],
    x => { const PR = list(x.losses).reduce((a, l) => a * (1 - l), 1); const H = x.GHI * x.tr; const Y = H * PR; return { PR, H, Y, E: Y * x.P / 1000, CF: Y / 8760 }; });
  add('DM', '3.3', 5, 'Instantaneous PV power', 'P(t) = P_DC,STC(G_POA/G_STC)[1 + γ(T_cell − 25)],  T_cell = T_amb + (NOCT − 20)/800·G_POA',
    [['P', 'DC capacity', 'kWp', 1000], ['G', 'G_POA', 'W/m²', 1000], ['Ta', 'Ambient', '°C', 40], ['NOCT', 'NOCT', '°C', 45], ['g', 'γ', '1/K', -0.0035]],
    [['Tc', 'Cell temperature', '°C'], ['Pdc', 'DC power', 'kW'], ['derate', 'Thermal derate', '–']],
    x => { const Tc = x.Ta + (x.NOCT - 20) / 800 * x.G; const d = 1 + x.g * (Tc - 25); return { Tc, Pdc: x.P * x.G / 1000 * d, derate: d }; });
  add('DM', '3.4', 5, 'Module, string, inverter and land counts', 'N_mod = P_DC/P_mod;  N_string = N_mod/n_s;  N_inv = P_DC/(r_DC/AC·S_inv);  A_land = P_DC·a_mod/GCR·(1 + f_infra)',
    [['P', 'DC capacity', 'MWp', 180], ['Pm', 'Module power', 'Wp', 620], ['Voc', 'Module V_oc (STC)', 'V', 50.5], ['beta', 'V_oc coefficient', '1/K', -0.0025], ['Tmin', 'Minimum temperature', '°C', 2], ['Vmax', 'System voltage', 'V', 1500], ['r', 'DC/AC ratio', '–', 1.25], ['S', 'Inverter rating', 'MVA', 4.2], ['amod', 'Module area', 'm²/kWp', 4.65], ['GCR', 'Ground coverage ratio', '–', 0.36], ['finfra', 'Infrastructure share', '–', 0.15]],
    [['Nmod', 'Modules', '–'], ['VocT', 'V_oc at T_min', 'V'], ['ns', 'Modules per string', '–'], ['Nstr', 'Strings', '–'], ['Ninv', 'Inverters', '–'], ['land', 'Land', 'ha']],
    x => { const N = Math.ceil(x.P * 1e6 / x.Pm); const V = x.Voc * (1 + x.beta * (x.Tmin - 25)); const ns = Math.floor(x.Vmax / V); return { Nmod: N, VocT: V, ns, Nstr: Math.ceil(N / ns), Ninv: Math.ceil(x.P / (x.r * x.S)), land: x.P * 1000 * x.amod / x.GCR * (1 + x.finfra) / 1e4 }; });
  add('DM', '3.5', 5, 'Optimum cleaning interval', 'N* = √(2c_clean/(s·E_d·v)),  ℓ̄_soil = ½·s·N*',
    [['c', 'Cost per cleaning', 'EUR/kWp', 0.15], ['s', 'Soiling rate', '1/d', 0.004], ['Ed', 'Daily energy', 'kWh/kWp', 6], ['v', 'Energy value', 'EUR/kWh', 0.0375]],
    [['N', 'Optimum interval', 'd'], ['l', 'Mean soiling loss', '–'], ['cost', 'Annual cleaning cost', 'EUR/kWp']],
    x => { const N = sqrt(2 * x.c / (x.s * x.Ed * x.v)); return { N, l: 0.5 * x.s * N, cost: 365 / N * x.c }; });
  add('DM', '4.1', 5, 'Weibull, mean speed and wind shear', 'v̄ = c·Γ(1 + 1/k);  v(z) = v(z_ref)(z/z_ref)^α;  α = ln(v₂/v₁)/ln(z₂/z₁)',
    [['v1', 'Speed at z₁', 'm/s', 6.1], ['z1', 'z₁', 'm', 10], ['v2', 'Speed at z₂', 'm/s', 8.6], ['z2', 'z₂', 'm', 100], ['zh', 'Hub height', 'm', 110], ['k', 'Weibull k', '–', 2.2]],
    [['alpha', 'Shear exponent α', '–'], ['vh', 'Hub-height mean', 'm/s'], ['G', 'Γ(1 + 1/k)', '–'], ['c', 'Weibull c at hub', 'm/s'], ['pd', 'Power density (ρ 1.2)', 'W/m²']],
    x => { const a = ln(x.v2 / x.v1) / ln(x.z2 / x.z1); const vh = x.v2 * pow(x.zh / x.z2, a); const G = H2.gamma(1 + 1 / x.k); const c = vh / G; return { alpha: a, vh, G, c, pd: 0.5 * 1.2 * pow(c, 3) * H2.gamma(1 + 3 / x.k) }; });
  add('DM', '4.2', 5, 'Net wind capacity factor', 'CF_net = CF_gross(1 − ℓ_wake)(1 − ℓ_avail)(1 − ℓ_el)(1 − ℓ_env)',
    [['CFg', 'Gross CF', '–', 0.456], ['lw', 'Wake', '–', 0.07], ['la', 'Availability', '–', 0.03], ['le', 'Electrical', '–', 0.02], ['lenv', 'Environmental', '–', 0.01], ['P', 'Farm rating', 'MW', 60]],
    [['CF', 'Net CF', '–'], ['FLH', 'Full-load hours', 'h'], ['E', 'Energy', 'GWh/a']],
    x => { const c = x.CFg * (1 - x.lw) * (1 - x.la) * (1 - x.le) * (1 - x.lenv); return { CF: c, FLH: c * 8760, E: c * 8.76 * x.P }; });
  add('DM', '5.1', 3, 'Thyristor rectifier relations', 'V_dc = V_dc0·cos α − ΔV_x,  V_dc0 = 1.35·V_LL,  cos φ ≈ μ·cos α,  μ = 0.955 (6-pulse), 0.989 (12-pulse) (5.2)',
    [['N', 'Cells in series', '–', 230], ['E', 'Cell voltage', 'V', 1.85], ['P', 'DC power', 'MW', 4.8], ['VLL', 'Secondary voltage', 'V', 360], ['dVx', 'Commutation drop', '–', 0.05], ['eta', 'η_rect', '–', 0.98], ['m', 'Transformer margin', '–', 0.08], ['p', 'Pulse number (6 or 12)', '–', 6]],
    [['Vdc', 'DC voltage', 'V'], ['Idc', 'DC current', 'kA'], ['Vdc0', 'V_dc0', 'V'], ['alpha', 'Firing angle', '°'], ['cosphi', 'Power factor', '–'], ['ST', 'Transformer rating (5.2)', 'MVA']],
    x => { const V = x.N * x.E, I = x.P * 1e6 / V / 1000; const V0 = 1.35 * x.VLL; const ca = (V + x.dVx * V0) / V0; const cp = (x.p >= 12 ? 0.989 : 0.955) * ca; return { Vdc: V, Idc: I, Vdc0: V0, alpha: Math.acos(Math.min(1, ca)) * 180 / PI, cosphi: cp, ST: x.P / (x.eta * cp) * (1 + x.m) }; });
  add('DM', '5.2', 3, 'Characteristic harmonics', 'I_h ≈ (I₁/h)·k_ov,  h = n·p ± 1',
    [['I1', 'Fundamental current', 'A', 1000], ['p', 'Pulse number', '–', 12], ['kov', 'Overlap reduction k_ov', '–', 0.8]],
    [['h1', 'First harmonic order', '–'], ['Ih1', 'I at h = p − 1', 'A'], ['Ih2', 'I at h = p + 1', 'A'], ['THD', 'Approx. THD (first 4 pairs)', '–']],
    x => { let s = 0; for (let n = 1; n <= 4; n++) for (const sg of [-1, 1]) { const h = n * x.p + sg; s += pow(x.kov / h, 2); } return { h1: x.p - 1, Ih1: x.I1 / (x.p - 1) * x.kov, Ih2: x.I1 / (x.p + 1) * x.kov, THD: sqrt(s) }; });
  add('DM', '5.3', 3, 'DC busbar sizing and losses', 'A_Cu = I/j;  R = ρ_Cu L/A;  P_loss = I²R;  ΔV = IR',
    [['I', 'Current', 'A', 11300], ['j', 'Current density', 'A/mm²', 1.6], ['rho', 'Resistivity', 'Ω m', 2.1e-8], ['L', 'Loop length', 'm', 20], ['Asel', 'Selected section (0 = required)', 'mm²', 7200]],
    [['Areq', 'Required section', 'mm²'], ['R', 'Resistance', 'µΩ'], ['P', 'Loss', 'kW'], ['dV', 'Voltage drop', 'V']],
    x => { const Ar = x.I / x.j; const A = x.Asel > 0 ? x.Asel : Ar; const R = x.rho * x.L / (A * 1e-6); return { Areq: Ar, R: R * 1e6, P: x.I * x.I * R / 1000, dV: x.I * R }; });
  add('DM', '5.4', 3, 'Short-circuit currents', 'I_sc,grid = S_sc/(√3V);  I_sc,T = S_T/(√3·V_sec·u_k);  IEC 60909: I″k = c·V_sec/(√3·|Z_Q + Z_T|), Z_Q = c·V_sec²/S_sc, Z_T = u_k·V_sec²/S_T',
    [['Ssc', 'Grid fault level', 'MVA', 250], ['V', 'Grid voltage', 'kV', 20], ['ST', 'Transformer rating', 'MVA', 6.3], ['Vs', 'Secondary voltage', 'kV', 0.36], ['uk', 'u_k', '–', 0.08], ['Smax', 'Plant load', 'MVA', 13.5], ['c', 'Voltage factor c_max (IEC 60909)', '–', 1.1]],
    [['Isc', 'Grid short-circuit', 'kA'], ['IscT', 'Transformer secondary (infinite grid)', 'kA'], ['Ik', 'Transformer secondary, IEC 60909', 'kA'], ['IL', 'Load current', 'A'], ['SCR', 'Short-circuit ratio', '–']],
    x => { const c = x.c > 0 ? x.c : 1.1; const zq = x.Ssc > 0 ? c / x.Ssc : 0, zt = x.uk / x.ST;      // impedances per unit of V_sec² (Ω·MVA/kV²)
      return { Isc: x.Ssc / (sqrt(3) * x.V), IscT: x.ST / (sqrt(3) * x.Vs * x.uk), Ik: c / (sqrt(3) * x.Vs * (zq + zt)), IL: x.Smax * 1000 / (sqrt(3) * x.V), SCR: x.Ssc / x.Smax }; });
  add('DM', '6.1', 6, 'Water demand of an electrolysis plant', 'V̇_DI = w_DI·ṁ_H₂;  V̇_raw = V̇_DI/Y_overall + V̇_cool + V̇_other;  Y_overall = Y₁Y₂/(1 − Y₁(1 − Y₂)) (6.2)',
    [['m', 'H₂ flow', 'kg/h', 1923], ['w', 'w_DI', 'L/kg', 10.5], ['Y1', 'First-pass recovery', '–', 0.42], ['Y2', 'Second-pass recovery', '–', 0.9], ['cool', 'Cooling make-up', 'm³/h', 0], ['other', 'Other uses', 'm³/h', 0]],
    [['DI', 'DI water', 'm³/h'], ['Y', 'Overall recovery', '–'], ['raw', 'Raw water', 'm³/h'], ['brine', 'Reject', 'm³/h'], ['spec', 'Specific raw water', 'L/kg']],
    x => { const DI = x.m * x.w / 1000; const Y = x.Y1 * x.Y2 / (1 - x.Y1 * (1 - x.Y2)); const raw = DI / Y + x.cool + x.other; return { DI, Y, raw, brine: DI / Y - DI, spec: raw * 1000 / x.m }; });
  add('DM', '6.3', 6, 'Demineralised-water tank', 'V_DI = max[V̇_DI,full·t_outage, max∫(V̇_DI − V̇_plant)dt] + V_dead;  V̇_plant = V̄_DI/A_water·(1 + m)',
    [['DIf', 'DI at full load', 'm³/h', 20.2], ['DIavg', 'Average DI', 'm³/h', 10], ['t', 'Outage to bridge', 'h', 12], ['Aw', 'Water-plant availability', '–', 0.95], ['m', 'Margin', '–', 0.15], ['day', 'Daytime hours at full load', 'h', 10], ['dead', 'Dead volume', '–', 0.12]],
    [['Vp', 'Treatment capacity', 'm³/h'], ['Vout', 'Outage volume', 'm³'], ['Vint', 'Daytime deficit volume', 'm³'], ['V', 'Tank volume', 'm³']],
    x => { const Vp = x.DIavg / x.Aw * (1 + x.m); const a = x.DIf * x.t; const b = Math.max(0, (x.DIf - Vp) * x.day); const v = Math.max(a, b); return { Vp, Vout: a, Vint: b, V: v * (1 + x.dead) }; });
  add('DM', '7.1', 6, 'Well yield and drawdown (Thiem)', 's = Q/(2πT)·ln(R/r_w),  T = K·b;  Q_sust ≤ recharge·A_catchment',
    [['Q', 'Abstraction', 'm³/d', 200], ['T', 'Transmissivity', 'm²/d', 200], ['R', 'Radius of influence', 'm', 500], ['rw', 'Well radius', 'm', 0.15], ['rech', 'Recharge', 'mm/a', 15], ['A', 'Catchment', 'km²', 60]],
    [['s', 'Drawdown', 'm'], ['rec', 'Recharge volume', 'm³/a'], ['ratio', 'Abstraction/recharge', '–']],
    x => { const r = x.rech / 1000 * x.A * 1e6; return { s: x.Q / (2 * PI * x.T) * ln(x.R / x.rw), rec: r, ratio: x.Q * 365 / r }; });
  add('DM', '7.2', 6, 'Rainwater yield', 'V_rain = A·h_rain·c_r·(1 − f_ff);  V_store ≈ V_rain/n_events … V_rain/2',
    [['A', 'Collection area', 'm²', 10000], ['h', 'Rainfall', 'mm/a', 700], ['cr', 'Runoff coefficient', '–', 0.85], ['ff', 'First flush', '–', 0.05], ['n', 'Rain events per year', '–', 80]],
    [['V', 'Annual yield', 'm³/a'], ['Vmin', 'Storage (lower)', 'm³'], ['Vmax', 'Storage (upper)', 'm³']],
    x => { const V = x.A * x.h / 1000 * x.cr * (1 - x.ff); return { V, Vmin: V / x.n, Vmax: V / 2 }; });
  add('DM', '8.1', 6, 'Osmotic pressure and concentrate', 'π = 2φ(c/M)RT ≈ 0.79·c_TDS;  c_c = c_f(1 − Y(1 − R_s))/(1 − Y);  c̄_p ≈ c_f(1 − R_s)(−ln(1 − Y)/Y) (8.2)',
    [['cf', 'Feed TDS', 'g/L', 41], ['Y', 'Recovery', '–', 0.42], ['Rs', 'Salt rejection', '–', 0.997]],
    [['pif', 'π feed', 'bar'], ['cc', 'Concentrate TDS', 'g/L'], ['pic', 'π concentrate', 'bar'], ['cp', 'Permeate TDS', 'mg/L']],
    x => { const cc = x.cf * (1 - x.Y * (1 - x.Rs)) / (1 - x.Y); return { pif: 0.79 * x.cf, cc, pic: 0.79 * cc, cp: 1000 * x.cf * (1 - x.Rs) * (-ln(1 - x.Y) / x.Y) }; });
  add('DM', '8.3', 6, 'RO flux, temperature correction and elements', 'J_w = A·TCF(p_f − ½Δp_loss − CP·π̄_fc + π_p);  TCF = exp[2640(1/298 − 1/T)];  N_el = Q_p/(J_w A_el)',
    [['A', 'Permeability A', 'L/(m² h bar)', 3], ['T', 'Temperature', '°C', 15], ['pf', 'Feed pressure', 'bar', 10.8], ['dpl', 'Pressure loss', 'bar', 1], ['CP', 'Concentration polarisation', '–', 1.1], ['pifc', 'Mean π feed-conc.', 'bar', 0.8], ['pip', 'π permeate', 'bar', 0.01], ['Qp', 'Permeate', 'm³/d', 163], ['Ael', 'Element area', 'm²', 40.9]],
    [['TCF', 'TCF', '–'], ['NDP', 'Net driving pressure', 'bar'], ['J', 'Flux', 'L/(m² h)'], ['N', 'Elements', '–']],
    x => { const t = exp(2640 * (1 / 298 - 1 / K(x.T))); const ndp = x.pf - x.dpl / 2 - x.CP * x.pifc + x.pip; const J = x.A * t * ndp; return { TCF: t, NDP: ndp, J, N: x.Qp * 1000 / 24 / (J * x.Ael) }; });
  add('DM', '8.4', 6, 'RO high-pressure energy (with/without ERD)', 'SEC_HP = p_f/(36η_pY);  SEC_HP+ERD = p_f/(36η_p) + (1 − Y)[(1 − η_ERD)p_b + Δp_loss + 1]/(36η_pY)',
    [['pf', 'Feed pressure', 'bar', 64.4], ['ep', 'Pump efficiency', '–', 0.8], ['Y', 'Recovery', '–', 0.42], ['eERD', 'ERD efficiency', '–', 0.96], ['pb', 'Brine pressure', 'bar', 62.9], ['dpl', 'Loss', 'bar', 1.5]],
    [['s0', 'SEC without ERD', 'kWh/m³'], ['s1', 'SEC with ERD (8.5)', 'kWh/m³'], ['save', 'ERD saving', '–']],
    x => { const a = x.pf / (36 * x.ep * x.Y); const b = x.pf / (36 * x.ep) + (1 - x.Y) * ((1 - x.eERD) * x.pb + x.dpl + 1) / (36 * x.ep * x.Y); return { s0: a, s1: b, save: 1 - b / a }; });
  add('DM', '8.6', 6, 'Langelier saturation index', 'LSI = pH − pH_s;  pH_s = (9.3 + A + B) − (C + D)',
    [['TDS', 'TDS', 'mg/L', 20000], ['T', 'Temperature', 'K', 301], ['Ca', 'Ca as CaCO₃', 'mg/L', 1500], ['Alk', 'Alkalinity as CaCO₃', 'mg/L', 820], ['pH', 'pH', '–', 7.9]],
    [['A', 'A', '–'], ['B', 'B', '–'], ['C', 'C', '–'], ['D', 'D', '–'], ['pHs', 'pH_s', '–'], ['LSI', 'LSI', '–']],
    x => { const A = (log10(x.TDS) - 1) / 10, B = -13.12 * log10(x.T) + 34.55, Cc = log10(x.Ca) - 0.4, D = log10(x.Alk); const p = 9.3 + A + B - (Cc + D); return { A, B, C: Cc, D, pHs: p, LSI: x.pH - p }; });
  add('DM', '8.7', 6, 'Gypsum saturation', 'S = γ₂²[Ca²⁺][SO₄²⁻]/K_sp;  log₁₀γ₂ = −2.036(√I/(1 + √I) − 0.3I);  I ≈ 2.5×10⁻⁵ TDS',
    [['CF', 'Concentration factor', '–', 4], ['TDS', 'Concentrate TDS', 'mg/L', 19600], ['Ca', 'Ca feed', 'mg/L', 150], ['SO4', 'SO₄ feed', 'mg/L', 900], ['Ksp', 'K_sp', '–', 2.5e-5]],
    [['I', 'Ionic strength', 'mol/L'], ['g', 'γ₂', '–'], ['S', 'Saturation ratio', '–']],
    x => { const I = 2.5e-5 * x.TDS; const lg = -2.036 * (sqrt(I) / (1 + sqrt(I)) - 0.3 * I); const g = pow(10, lg); const ca = x.Ca * x.CF / 40080, so = x.SO4 * x.CF / 96060; return { I, g, S: g * g * ca * so / x.Ksp }; });
  add('DM', '8.8', 6, 'Brine outfall dilution', 'S_r ≈ 1.6·Fr;  Fr = u₀/√(g′d₀);  g′ = g(ρ_b − ρ_a)/ρ_a;  S_req = (c_b − c_a)/Δc_allowed',
    [['cb', 'Brine TDS', 'g/L', 68], ['ca', 'Ambient TDS', 'g/L', 41], ['dc', 'Allowed excess', 'g/L', 1.5], ['rb', 'Brine density', 'kg/m³', 1045], ['ra', 'Seawater density', 'kg/m³', 1025], ['u0', 'Jet velocity', 'm/s', 4], ['d0', 'Port diameter', 'm', 0.04]],
    [['Sreq', 'Required dilution', '–'], ['gp', 'g′', 'm/s²'], ['Fr', 'Froude number', '–'], ['Sr', 'Achieved dilution', '–'], ['ok', 'Adequate (1 = yes)', '–']],
    x => { const gp = C.g * (x.rb - x.ra) / x.ra; const Fr = x.u0 / sqrt(gp * x.d0); const S = 1.6 * Fr; const Sreq = (x.cb - x.ca) / x.dc; return { Sreq, gp, Fr, Sr: S, ok: S >= Sreq ? 1 : 0 }; });
  add('DM', '8.9', 6, 'Evaporation pond / ZLD', 'A_pond = Q_b/(k_pan·E_pan − P);  E_ZLD ≈ 20–40 kWh/m³',
    [['Q', 'Brine', 'm³/d', 98], ['k', 'Pan coefficient', '–', 0.7], ['Ep', 'Pan evaporation', 'm/a', 2.2], ['P', 'Precipitation', 'm/a', 0.04], ['eZ', 'ZLD energy', 'kWh/m³', 30]],
    [['A', 'Pond area', 'm²'], ['EZ', 'ZLD alternative', 'MWh/a']],
    x => ({ A: x.Q * 365 / (x.k * x.Ep - x.P), EZ: x.Q * 365 * x.eZ / 1000 }));
  add('DM', '8.10', 6, 'Levelised cost of demineralised water', 'LCOW = [CAPEX·CRF(r,n) + OPEX_fixed]/V_annual + SEC·p_el + c_chem + c_membranes',
    [['CAPEX', 'CAPEX', 'MEUR', 5], ['r', 'WACC', '–', 0.08], ['n', 'Life', 'a', 25], ['fix', 'Fixed OPEX', 'MEUR/a', 0.23], ['V', 'Annual volume (product)', 'm³/a', 83000], ['SEC', 'Energy', 'kWh/m³', 4], ['pel', 'Electricity', 'EUR/kWh', 0.05], ['chem', 'Chemicals', 'EUR/m³', 0.05], ['mem', 'Membranes', 'EUR/m³', 0.04], ['w', 'DI per kg H₂', 'L/kg', 10.5]],
    [['CRF', 'CRF', '1/a'], ['LCOW', 'LCOW', 'EUR/m³'], ['perkg', 'Cost per kg H₂', 'EUR/kg']],
    x => { const c = H2.CRF(x.r, x.n); const L = (x.CAPEX * 1e6 * c + x.fix * 1e6) / x.V + x.SEC * x.pel + x.chem + x.mem; return { CRF: c, LCOW: L, perkg: L * x.w / 1000 }; });
  add('DM', '9.1', 7, 'Stack heat and cooling duty', 'Q̇_stack = P_DC(1 − E_tn/E_cell) + P_DC(1 − η_F) − Q̇_gas − Q̇_evap;  q_stack = 26.59(E_cell − E_tn);  Q̇ < 0 → heat input (SOEC)',
    [['P', 'DC power', 'MW', 5], ['E', 'Cell voltage', 'V', 1.85], ['etaF', 'η_F', '–', 0.99], ['fg', 'Gas + evaporation share', '–', 0.07], ['Etn', 'Thermoneutral voltage (1.481 liquid water, ≈1.29 steam)', 'V', 1.481], ['fE', 'End-of-life voltage factor', '–', 1.1]],
    [['Q', 'Stack heat to loop', 'MW'], ['q', 'Specific heat', 'kWh/kg'], ['QEoL', 'Heat at end of life', 'MW'], ['Qin', 'Heat demand (below E_tn)', 'MW']],
    x => { const Etn = x.Etn > 0 ? x.Etn : C.Etn25, fE = x.fE > 0 ? x.fE : 1.1; const f = E => (x.P * (1 - Etn / E) + x.P * (1 - x.etaF)) * (1 - x.fg);
      const Q0 = f(x.E); return { Q: Math.max(0, Q0), q: C.kSEC * (x.E - Etn), QEoL: Math.max(0, f(x.E * fE)), Qin: Math.max(0, -Q0) }; });
  add('DM', '9.2', 7, 'Dry cooler sizing', 'Q̇ = U·A·ΔT_lm;  V̇_air = Q̇/(ρ_a c_p,a ΔT_a) (9.3)',
    [['Q', 'Duty', 'MW', 26.4], ['Tci', 'Coolant in', '°C', 80], ['Tco', 'Coolant out', '°C', 70], ['Tai', 'Air in', '°C', 45], ['Tao', 'Air out', '°C', 60], ['U', 'U', 'W/(m² K)', 30], ['fan', 'Fan power', 'W per m³/s', 415]],
    [['dTlm', 'ΔT_lm', 'K'], ['A', 'Finned area', 'm²'], ['Vair', 'Air flow', 'm³/s'], ['Pfan', 'Fan power', 'kW']],
    x => { const a = x.Tci - x.Tao, b = x.Tco - x.Tai; const lm = Math.abs(a - b) < 1e-9 ? a : (a - b) / ln(a / b); const A = x.Q * 1e6 / (x.U * lm); const V = x.Q * 1e6 / (1.1 * 1005 * (x.Tao - x.Tai)); return { dTlm: lm, A, Vair: V, Pfan: V * x.fan / 1000 }; });
  add('DM', '9.3', 7, 'Dry cooler derating with ambient', 'Q̇(T_a)/Q̇_design ≈ (T̄_c − T̄_a)/(T̄_c − T̄_a,design)',
    [['Tc', 'Mean coolant temperature', '°C', 75], ['Ta', 'Actual ambient', '°C', 47], ['Tad', 'Design ambient', '°C', 45]], [['r', 'Capacity ratio', '–']],
    x => ({ r: (x.Tc - x.Ta) / (x.Tc - x.Tad) }));
  add('DM', '9.4', 7, 'Cooling-tower water balance', 'V̇_evap = Q̇/(ρh_fg) ≈ 1.5 L/kWh;  V̇_bd = V̇_evap/(COC − 1) − V̇_drift;  V̇_makeup = V̇_evap + V̇_bd + V̇_drift',
    [['Q', 'Heat load', 'MW', 30.8], ['hfg', 'h_fg', 'kJ/kg', 2450], ['COC', 'Cycles of concentration', '–', 4], ['drift', 'Drift', 'm³/h', 0]],
    [['ev', 'Evaporation', 'm³/h'], ['bd', 'Blowdown', 'm³/h'], ['mk', 'Make-up', 'm³/h']],
    x => { const e = x.Q * 1000 / x.hfg * 3.6; const b = e / (x.COC - 1) - x.drift; return { ev: e, bd: b, mk: e + b + x.drift }; });
  add('DM', '10.1', 4, 'Lye circulation, separators and inventory', 'V̇_lye = Q̇_stack/(ρc_pΔT);  u_gas ≤ K√((ρ_L − ρ_G)/ρ_G);  m_KOH = 0.30ρV_lye',
    [['Q', 'Stack heat', 'MW', 1.32], ['rho', 'Lye density', 'kg/m³', 1290], ['cp', 'Lye c_p', 'kJ/(kg K)', 3.0], ['dT', 'ΔT', 'K', 10], ['K', 'Souders–Brown K', 'm/s', 0.05], ['rG', 'Gas density', 'kg/m³', 2], ['V', 'Lye volume', 'm³', 120]],
    [['Vl', 'Lye circulation', 'm³/h'], ['u', 'Max gas velocity', 'm/s'], ['mKOH', 'KOH inventory', 't']],
    x => ({ Vl: x.Q * 1000 / (x.rho * x.cp * x.dT) * 3600, u: x.K * sqrt((x.rho - x.rG) / x.rG), mKOH: 0.3 * x.rho * x.V / 1000 }));
  add('DM', '10.2', 4, 'Crossover and minimum load', 'HTO(j) ≈ a + b/j;  j_min = b/(HTO_trip − a)',
    [['j1', 'Test point j₁', 'A/cm²', 0.6], ['h1', 'HTO at j₁', '%', 0.67], ['j2', 'Test point j₂', 'A/cm²', 0.3], ['h2', 'HTO at j₂', '%', 1.13], ['alarm', 'Alarm', '%', 1.5], ['trip', 'Trip', '%', 2], ['jn', 'Nominal j', 'A/cm²', 0.6]],
    [['a', 'a', '%'], ['b', 'b', '% A/cm²'], ['ja', 'j at alarm', 'A/cm²'], ['jt', 'j at trip', 'A/cm²'], ['Lmin', 'Minimum load (alarm)', '–']],
    x => { const b = (x.h2 - x.h1) / (1 / x.j2 - 1 / x.j1); const a = x.h1 - b / x.j1; const ja = b / (x.alarm - a); return { a, b, ja, jt: b / (x.trip - a), Lmin: ja / x.jn }; });
  add('DM', '10.3', 14, 'Nitrogen purge volume', 'n = ln(c₀/c_target);  V_N₂ = max(n, 5)·V_system·p_purge/p₀',
    [['c0', 'Initial concentration', '%', 21], ['ct', 'Target', '%', 1], ['V', 'System volume', 'm³', 20], ['pp', 'Purge pressure', 'bar', 1], ['p1', 'Pressure-cycle fill p₁', 'bar', 6], ['p2', 'Vent p₂', 'bar', 1.2]],
    [['n', 'Volume changes n', '–'], ['VN2', 'Nitrogen', 'Nm³'], ['k', 'Pressure cycles needed', '–']],
    x => { const n = ln(x.c0 / x.ct); return { n, VN2: Math.max(n, 5) * x.V * x.pp / 1.01325, k: Math.ceil(ln(x.ct / x.c0) / ln(x.p2 / x.p1)) }; });
  add('DM', '11.1', 14, 'Layer-of-protection analysis and SIL', 'f_mit = f_init·ΠPFDᵢ;  PFD_SIF ≤ f_tol/f_mit;  PFD_avg ≈ ½λ_DU·T_proof',
    [['fi', 'Initiating frequency', '1/a', 0.1], ['pfd', 'Other IPL PFDs (list)', '–', '0.1'], ['ft', 'Tolerable frequency', '1/a', 1e-5], ['lam', 'λ_DU', '1/h', 5e-7]],
    [['fm', 'Mitigated frequency', '1/a'], ['PFD', 'Required PFD_SIF', '–'], ['SIL', 'Required SIL', '–'], ['Tp', 'Max proof-test interval', 'h']],
    x => { const fm = x.fi * list(x.pfd).reduce((a, b) => a * b, 1); const P = x.ft / fm; const sil = P >= 0.1 ? 0 : P >= 0.01 ? 1 : P >= 0.001 ? 2 : P >= 1e-4 ? 3 : 4; return { fm, PFD: P, SIL: sil, Tp: 2 * P / x.lam }; });
  add('DM', '11.2', 14, 'Ventilation requirements (NFPA vs IEC)', 'V̇_NFPA = 0.00508·A_floor;  V̇_IEC = ṁ_leak/(k·c_LFL)·T/293;  V_z = f·V̇_IEC/C',
    [['A', 'Floor area', 'm²', 6000], ['m', 'Release rate', 'kg/s', 0.001], ['k', 'Safety factor k', '–', 0.5], ['cL', 'c_LFL', 'kg/m³', 0.00335], ['T', 'Temperature', 'K', 293], ['f', 'Ventilation efficiency f', '–', 3], ['Vroom', 'Room volume', 'm³', 60000], ['ach', 'Air changes', '1/h', 1]],
    [['VN', 'NFPA 2 flow', 'm³/s'], ['VI', 'IEC 60079-10-1 flow', 'm³/s'], ['Vz', 'Hypothetical volume V_z', 'm³']],
    x => { const vi = x.m / (x.k * x.cL) * x.T / 293; return { VN: 0.00508 * x.A, VI: vi, Vz: x.f * vi / (x.ach / 3600) }; });
  add('DM', '12.1', 8, 'Compressor stages, temperatures and power', 'N = ⌈ln(p₂/p₁)/ln r_max⌉;  r = (p₂/p₁)^(1/N);  T₂ = T₁ + T₁(r^((γ−1)/γ) − 1)/η_s;  w (12.2);  Q̇_cool ≈ 0.9P',
    [['p1', 'Suction', 'bar', 30], ['p2', 'Discharge', 'bar', 250], ['rmax', 'r_max', '–', 2.3], ['T1', 'Suction', '°C', 35], ['es', 'η_s', '–', 0.75], ['em', 'η_mech·η_motor', '–', 0.92], ['m', 'Flow', 'kg/h', 182]],
    [['N', 'Stages', '–'], ['r', 'Ratio', '–'], ['T2', 'Discharge per stage', '°C'], ['w', 'Specific power', 'kWh/kg'], ['P', 'Shaft power', 'kW'], ['Q', 'Cooling', 'kW']],
    x => { const c = H2.compress(x.p1, x.p2, x.T1, { rmax: x.rmax, eta_s: x.es, eta_mech: x.em, eta_motor: 1, mdot_kgh: x.m }); return { N: c.N, r: c.r, T2: c.T2_C, w: c.SEC_kWhkg, P: c.P_kW, Q: c.Q_cool_kW }; });
  add('DM', '13.1', 9, 'Buffer sizing from the hourly balance', 'I(t) = I(0) + Σ(ṁ_prod − ṁ_off)Δτ;  m_usable = max I − min I;  V = m_usable/[ρ(p_max) − ρ(p_min)] (13.2)',
    [['mu', 'Usable mass (from hourly model)', 'kg', 3000], ['pmax', 'p_max', 'bar', 250], ['pmin', 'p_min', 'bar', 35], ['T', 'Temperature', '°C', 15]],
    [['rmax', 'ρ(p_max)', 'kg/m³'], ['rmin', 'ρ(p_min)', 'kg/m³'], ['V', 'Geometric volume', 'm³'], ['mtot', 'Total inventory', 'kg']],
    x => { const T = K(x.T); const a = H2.rho(x.pmax, T), b = H2.rho(x.pmin, T); const V = x.mu / (a - b); return { rmax: a, rmin: b, V, mtot: V * a }; },
    'Run the Hourly Simulation to obtain the usable mass from the inventory curve; this calculator converts it into a volume.');
  add('DM', '13.3', 9, 'Shell thickness – ASME VIII Div. 1 & 2, EN 13445', 'Div.1: t = PR/(SE − 0.6P) + c;  Div.2: t = (D/2)[exp(P/SE) − 1] + c;  EN: e = PD/(2fz − P) + c, f = min(R_p0.2/1.5, R_m/2.4)',
    [['P', 'Design pressure', 'MPa', 22], ['D', 'Inside diameter', 'mm', 1000], ['S1', 'Div. 1 allowable S', 'MPa', 138], ['S2', 'Div. 2 allowable S', 'MPa', 200], ['E', 'Joint efficiency', '–', 1], ['Rp', 'R_p0.2', 'MPa', 355], ['Rm', 'R_m', 'MPa', 490], ['c', 'Corrosion allowance', 'mm', 1]],
    [['t1', 'ASME Div. 1', 'mm'], ['t2', 'ASME Div. 2', 'mm'], ['f', 'EN nominal stress f', 'MPa'], ['e', 'EN 13445', 'mm'], ['valid1', 'Div. 1 thin-shell formula valid (P ≤ 0.385·S·E)', '–'], ['t1x', 'Div. 1 App. 1-2 thick wall', 'mm']],
    x => { const R = x.D / 2; const f = Math.min(x.Rp / 1.5, x.Rm / 2.4); const SE = x.S1 * x.E, Z = (SE + x.P) / Math.max(1e-9, SE - x.P);
      return { t1: x.P * R / (SE - 0.6 * x.P) + x.c, t2: R * (exp(x.P / (x.S2 * x.E)) - 1) + x.c, f, e: x.P * x.D / (2 * f * x.E - x.P) + x.c, valid1: x.P <= 0.385 * SE ? 1 : 0, t1x: x.P < SE ? R * (sqrt(Z) - 1) + x.c : NaN }; });
  add('DM', '14.2', 10, 'Pipeline wall – B31.12 vs EN 1594', '[NFPA/ASME] t = PD_o/(2SFETH_f);  [ISO/EN] t = PD_o/(2σ_y f_d)',
    [['P', 'Design pressure', 'MPa', 3.3], ['D', 'Outside diameter', 'mm', 88.9], ['S', 'SMYS', 'MPa', 359], ['F', 'Design factor F', '–', 0.5], ['Hf', 'H_f', '–', 0.874], ['fd', 'EN design factor', '–', 0.5]],
    [['tA', 'B31.12', 'mm'], ['tE', 'EN 1594', 'mm']],
    x => ({ tA: x.P * x.D / (2 * x.S * x.F * x.Hf), tE: x.P * x.D / (2 * x.S * x.fd) }));
  add('DM', '14.3', 10, 'Trailer fleet and filling', 'n_trips = m_daily/m_payload;  N_trailers = n_trips(t_fill + t_round + t_unload)/24 + N_spare;  t_fill = m_payload/ṁ_comp',
    [['m', 'Daily demand', 'kg/d', 500], ['mp', 'Payload', 'kg', 1100], ['mc', 'Filling compressor', 'kg/h', 60], ['tr', 'Round trip', 'h', 2.5], ['tu', 'Time at station', 'h', 48], ['sp', 'Spares', '–', 1]],
    [['n', 'Trips per day', '–'], ['tf', 'Fill time', 'h'], ['N', 'Trailers', '–']],
    x => { const n = x.m / x.mp; const tf = x.mp / x.mc; return { n, tf, N: Math.ceil(n * (tf + x.tr + x.tu) / 24) + x.sp }; });
  add('DM', '15.3', 11, 'Ammonia synthesis energy', 'E_synth = e_ASU·m_N₂ + w_H₂·m_H₂ + w_N₂·m_N₂ + e_loop·m_NH₃;  m_H₂ = 0.178m_NH₃/η_loop (15.2)',
    [['mNH3', 'Ammonia', 't/h', 6.81], ['eta', 'Loop yield η_loop', '–', 0.97], ['eASU', 'e_ASU', 'kWh/kg N₂', 0.12], ['wH2', 'H₂ make-up compression', 'kWh/kg', 1.0], ['wN2', 'N₂ compression', 'kWh/kg', 0.14], ['eloop', 'e_loop', 'kWh/kg NH₃', 0.12]],
    [['mH2', 'Hydrogen', 't/h'], ['mN2', 'Nitrogen', 't/h'], ['E', 'Synthesis electricity', 'MWh/t NH₃'], ['P', 'Synthesis power', 'MW'], ['Q', 'Reaction heat (15.1)', 'MW']],
    x => { const h = 0.178 * x.mNH3 / x.eta, n = 0.822 * x.mNH3 / x.eta; const E = (x.eASU * n + x.wH2 * h + x.wN2 * n + x.eloop * x.mNH3) / x.mNH3; return { mH2: h, mN2: n, E, P: E * x.mNH3, Q: x.mNH3 * 2.71 / 3.6 }; });
  add('DM', '16.1', 11, 'Refuelling-station sizing', 'ṁ_peak = f_peak·m_day;  ṁ_comp = m_day/t_op·(1 + m);  m_cascade ≥ n_b2b·m_fill − ṁ_comp·t_b2b;  E_precool = m c_p(T_in − T_out)/COP (16.2)',
    [['m', 'Daily sales', 'kg/d', 500], ['fp', 'Peak-hour fraction', '–', 0.12], ['top', 'Compressor hours', 'h/d', 20], ['mg', 'Margin', '–', 0.25], ['nb', 'Back-to-back fills', '–', 6], ['mf', 'Fill size', 'kg', 5], ['tb', 'B2B duration', 'h', 0.5], ['cp', 'c_p', 'kJ/(kg K)', 14.3], ['Tin', 'Gas in', '°C', 25], ['Tout', 'Dispenser', '°C', -40], ['COP', 'Chiller COP', '–', 1.2]],
    [['peak', 'Peak demand', 'kg/h'], ['comp', 'Compressor', 'kg/h'], ['casc', 'Cascade mass', 'kg'], ['Epc', 'Pre-cooling', 'kWh/kg']],
    x => { const c = x.m / x.top * (1 + x.mg); return { peak: x.fp * x.m, comp: c, casc: Math.max(0, x.nb * x.mf - c * x.tb), Epc: x.cp * (x.Tin - x.Tout) / x.COP / 3600 }; });
  add('DM', '16.3', 11, 'Hot-fill pressure target', 'ρ_target = ρ(700 bar, 15 °C);  p_end(T) = ρ_target R′T/(1 − ρ_target b′)',
    [['NWP', 'Nominal working pressure', 'bar', 700], ['T', 'Gas temperature at end of fill', '°C', 85]],
    [['rho', 'Target density', 'kg/m³'], ['p', 'End pressure', 'bar']],
    x => { const r = H2.rho(x.NWP, K(15)); return { rho: r, p: H2.pFromRho(r, K(x.T)) }; });
  add('DM', '17.1', 11, 'Hydrogen to power and heat', 'ṁ_H₂ = P_e/(η_e·LHV);  Q̇_heat = P_e·η_th/η_e',
    [['P', 'Electrical output', 'kW', 100], ['ee', 'η_e', '–', 0.5], ['eth', 'η_th', '–', 0.38], ['h', 'Operating hours', 'h/a', 2000]],
    [['m', 'H₂', 'kg/h'], ['Q', 'Heat', 'kW'], ['ma', 'Annual H₂', 't/a'], ['kWhkg', 'Electricity per kg', 'kWh/kg']],
    x => { const m = x.P / (x.ee * C.LHV); return { m, Q: x.P * x.eth / x.ee, ma: m * x.h / 1000, kWhkg: x.ee * C.LHV }; });
  add('DM', '17.3', 11, 'Power-to-power round trip and LCOS', 'η_RT = η_FC·LHV/SEC·η_comp;  LCOS = (CRF·C_cap + O)/E_discharged + p_in/η_RT',
    [['eFC', 'η_FC', '–', 0.5], ['SEC', 'Electrolyser SEC', 'kWh/kg', 55], ['ec', 'Compression factor', '–', 0.97], ['Ccap', 'CAPEX', 'MEUR', 3], ['r', 'WACC', '–', 0.07], ['n', 'Life', 'a', 20], ['O', 'O&M', 'MEUR/a', 0.06], ['E', 'Energy discharged', 'MWh/a', 500], ['pin', 'Input electricity', 'EUR/MWh', 20]],
    [['eta', 'Round-trip efficiency', '–'], ['LCOS', 'LCOS', 'EUR/MWh']],
    x => { const e = x.eFC * C.LHV / x.SEC * x.ec; return { eta: e, LCOS: (H2.CRF(x.r, x.n) * x.Ccap + x.O) * 1e6 / x.E + x.pin / e }; });
  add('DM', '20.1', 12, 'Capital-cost build-up', 'CAPEX = ΣCᵢ·(1 + f_ind)·(1 + f_cont + f_own)',
    [['direct', 'Direct costs (list)', 'MEUR', '15,0.3,1.5,1.8,1.3,0.5,2.5,0.6,2.5,0.8,0.8'], ['fi', 'Indirect f_ind', '–', 0.12], ['fc', 'Contingency f_cont', '–', 0.10], ['fo', 'Owner f_own', '–', 0.04], ['P', 'Electrolyser rating', 'MW', 10]],
    [['D', 'Direct', 'MEUR'], ['CAPEX', 'Total CAPEX', 'MEUR'], ['spec', 'Specific', 'EUR/kW']],
    x => { const D = list(x.direct).reduce((a, b) => a + b, 0); const T = D * (1 + x.fi) * (1 + x.fc + x.fo); return { D, CAPEX: T, spec: T / x.P * 1000 }; });
  add('DM', '20.2', 12, 'Levelised cost of hydrogen (full)', 'LCOH = [CRF(CAPEX + PV_stacks) + OPEX_fixed + E_el·p_el + c_water − R_by-prod]/m_H₂',
    [['CAPEX', 'CAPEX', 'MEUR', 35.2], ['r', 'WACC', '–', 0.07], ['n', 'Life', 'a', 25], ['st', 'Stack replacement', 'MEUR', 4.5], ['sy', 'Replacement year', 'a', 12], ['fix', 'Fixed OPEX', 'MEUR/a', 1.56], ['E', 'Electricity', 'GWh/a', 66.6], ['pel', 'Electricity price', 'EUR/MWh', 80], ['cw', 'Water', 'MEUR/a', 0], ['by', 'By-product revenue', 'MEUR/a', 0], ['m', 'Hydrogen', 't/a', 1090], ['target', 'Target LCOH', 'EUR/kg', 6]],
    [['CRF', 'CRF', '1/a'], ['PVst', 'PV of stacks', 'MEUR'], ['tot', 'Annual cost', 'MEUR/a'], ['LCOH', 'LCOH', 'EUR/kg'], ['cap', 'of which capital', 'EUR/kg'], ['el', 'of which electricity', 'EUR/kg'], ['pbe', 'Break-even electricity price', 'EUR/MWh']],
    x => { const c = H2.CRF(x.r, x.n); const pv = x.st / pow(1 + x.r, x.sy); const fixedPart = c * (x.CAPEX + pv) + x.fix + x.cw - x.by; const tot = fixedPart + x.E * x.pel / 1000;
      return { CRF: c, PVst: pv, tot, LCOH: tot / x.m * 1000, cap: c * x.CAPEX / x.m * 1000, el: x.E * x.pel / x.m, pbe: (x.target * x.m / 1000 - fixedPart) / x.E * 1000 }; });

  /* Lookup helpers */
  H2.eq = function (id) { return EQ.find(e => e.id === id || e.ref === id); };
  H2.run = function (id, inputs) {
    const e = H2.eq(id); if (!e) throw new Error('Unknown equation ' + id);
    const x = {}; e.inputs.forEach(i => { x[i[0]] = i[3]; });
    Object.assign(x, inputs || {});
    e.inputs.forEach(i => { if (typeof i[3] === 'number' && typeof x[i[0]] === 'string' && x[i[0]] !== '') x[i[0]] = Number(x[i[0]]); });
    return e.f(x);
  };
  H2.sweep = function (id, key, from, to, n, fixed) {
    const out = []; n = n || 40;
    for (let i = 0; i <= n; i++) { const v = from + (to - from) * i / n; const o = {}; o[key] = v; out.push(Object.assign({ x: v }, H2.run(id, Object.assign({}, fixed || {}, o)))); }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);

;
/* Hasim – Green Hydrogen Engineering Suite. © 2026 Prof. Hani Muhsen. All rights reserved. */
/* =====================================================================
   Hasim – plant-level integration: design cases, integrated plant
   designer (all levels), flowsheet blocks and predefined experiments.
   ===================================================================== */
(function (root) {
  'use strict';
  const H2 = root.H2, C = H2.C, K = H2.K, own = H2.own;
  const R = (id, x) => H2.run(id, x);

  /* ------------------------------------------------------------------
     1. Design bases (DM Tables 1.4 and 1.5) + a small-scale case
        Case B: 4 900 full-load hours of operation for the sizing chain, the value of the 8760-hour simulation
        (CF × 8760 / availability); the first estimate of the DM, 4 400 h, calls for 112 MW with the life-average SEC
     ------------------------------------------------------------------ */
  H2.CASES = {
    A: { name: 'Case A – 10 MW PEM, grid-connected, industrial park', product: 'H2', demand: 3000, demandUnit: 'kg/d',
      tech: 'PEM', modules: 2, moduleMW: 5, supply: 'grid-ppa', FLH: 6000, availability: 0.96,
      pvMWp: 30, pvYield: 1050, windMW: 15, windFLH: 2600, curtail: 0, GHI: 1150, lat: 50, vmean: 7.3, gridCI: 300, ppaShare: 0.9,
      pel: 80, water: 'municipal', TDS: 0.35, Y1: 0.8, Y2: 1.0, wDI: 10, cooling: 'dry', Tamb: 35,
      storeP: 250, storeDays: 1, storeFrac: 1.0, deliver: 'pipeline', pipeKm: 2, pipeP: 25, trailer_kgd: 500,
      capexEly: 1500, WACC: 0.07, life: 25, otherCapexFrac: 0.84, fixedOpexFrac: 0.044, stackFrac: 0.3 },
    B: { name: 'Case B – 100 MW AEL, islanded hybrid, ammonia export', product: 'NH3', demand: 45000, demandUnit: 't/a NH3',
      tech: 'AEL', modules: 20, moduleMW: 5, supply: 'islanded', FLH: 4900, availability: 0.95,
      pvMWp: 180, pvYield: 2050, windMW: 60, windFLH: 3500, curtail: 0.15, GHI: 2200, lat: 29, vmean: 8.6, gridCI: 450, ppaShare: 1,
      pel: 65, water: 'seawater', TDS: 41, Y1: 0.42, Y2: 0.9, wDI: 10.5, cooling: 'dry', Tamb: 45,
      storeP: 100, storeDays: 0.65, storeFrac: 1.0, deliver: 'ammonia', pipeKm: 1, pipeP: 30, trailer_kgd: 0,
      capexEly: 1000, WACC: 0.08, life: 25, otherCapexFrac: 1.05, fixedOpexFrac: 0.03, stackFrac: 0.3 },
    C: { name: 'Case C – 1 MW PEM refuelling hub (small scale)', product: 'H2', demand: 400, demandUnit: 'kg/d',
      tech: 'PEM', modules: 1, moduleMW: 1.25, supply: 'grid-ppa', FLH: 7000, availability: 0.97,
      pvMWp: 2, pvYield: 1600, windMW: 0, windFLH: 0, curtail: 0, GHI: 2000, lat: 32, vmean: 5, gridCI: 450, ppaShare: 0.35,
      pel: 90, water: 'municipal', TDS: 0.6, Y1: 0.75, Y2: 1.0, wDI: 11, cooling: 'dry', Tamb: 40,
      storeP: 500, storeDays: 1, storeFrac: 1.0, deliver: 'hrs', pipeKm: 0, pipeP: 30, trailer_kgd: 0,
      capexEly: 2200, WACC: 0.08, life: 20, otherCapexFrac: 1.5, fixedOpexFrac: 0.05, stackFrac: 0.3 }
  };

  /* ------------------------------------------------------------------
     Shared screening helpers of the design chain and the system solver
     ------------------------------------------------------------------ */
  // coolant loop of the stack cooling (DM 9.1): liquid-water stacks 20/10 K below the stack temperature; SOEC loop for condensers and compressors
  H2.coolingLoop = tp => (tp.steam ? { Tsup: 50, Tret: 65 } : { Tsup: tp.T_C - 20, Tret: tp.T_C - 10 });
  // dry-cooler design point (DM 9.2/9.3): air from the design ambient, at least 5 K below the coolant outlet; otherwise adiabatic pre-cooling is assumed
  H2.dryCoolerDesign = function (Q_MW, loop, Tamb) {
    const feasible = loop.Tsup - Tamb >= 5, Tai = feasible ? Tamb : loop.Tsup - 8, Tao = Math.min(Tai + 15, loop.Tsup);
    const d = R('DM-9.2', { Q: Math.max(Q_MW, 1e-6), Tci: loop.Tret, Tco: loop.Tsup, Tai, Tao, U: 30, fan: 415 });
    return Object.assign(d, { feasible, Tai, Tao, Tamb });
  };
  // outside diameters of line pipe (ASME B36.10M), mm
  H2.PIPE_OD = { 25: 33.4, 40: 48.3, 50: 60.3, 80: 88.9, 100: 114.3, 150: 168.3, 200: 219.1, 250: 273.1, 300: 323.9, 350: 355.6, 400: 406.4, 500: 508, 600: 610, 700: 711, 800: 813, 900: 914, 1000: 1016, 1200: 1219 };
  // ASME B31.12 Table IX-5A, material performance factor H_f for SMYS ≤ 52 ksi (X52 / L360) against design pressure in psig
  const HF_X52 = [[1000, 1.0], [2000, 1.0], [2200, 0.954], [2400, 0.91], [2600, 0.88], [2800, 0.84], [3000, 0.78]];
  H2.hfX52 = function (psig) { if (psig <= HF_X52[0][0]) return 1; for (let i = 1; i < HF_X52.length; i++) if (psig <= HF_X52[i][0]) { const a = HF_X52[i - 1], b = HF_X52[i]; return a[1] + (b[1] - a[1]) * (psig - a[0]) / (b[0] - a[0]); } return HF_X52[HF_X52.length - 1][1]; };
  /* Pipeline wall (DM 14.2): ASME B31.12 option A (prescriptive), design factor F = 0.5 (location classes 1–3), X52 line pipe,
     design pressure 1.1 × operating pressure, 1 mm corrosion allowance; EIGA Doc 121 minimum wall 6.4 mm and hoop stress ≤ 30 % SMYS */
  H2.pipeWall = function (dn, pOp_bar) {
    const OD = own(H2.PIPE_OD, String(dn)) || dn + 8, Pd = pOp_bar / 10 * 1.1, Hf = H2.hfX52(Pd * 145.038);
    const w = R('DM-14.2', { P: Pd, D: OD, S: 359, F: 0.5, Hf, fd: 0.5 });
    const tReq = w.tA + 1.0, tSel = Math.max(6.4, Math.ceil(tReq * 10) / 10), hoop = pOp_bar / 10 * OD / (2 * tSel);
    return { DN: dn, OD, Pd, Hf, F: 0.5, tA: w.tA, tE: w.tE, tReq, tSel, hoop, hoopFrac: hoop / 359 };
  };
  // vessel diameter by pressure (tube bundles above 300 bar, cylinders above 150 bar, bullets below)
  H2.vesselGeometry = p => (p >= 300 ? { D: 0.5, V: 2.5, kind: 'tube' } : p >= 150 ? { D: 1.0, V: 12, kind: 'cylinder' } : { D: 2.4, V: 60, kind: 'bullet' });
  /* Shell wall of a storage vessel (DM 13.3): ASME VIII Div. 1 UG-27 while P ≤ 0.385·S·E, App. 1-2 thick-wall formula above */
  H2.vesselWall = function (p_bar) {
    const g = H2.vesselGeometry(p_bar), v = R('DM-13.3', { P: p_bar / 10 * 1.1, D: g.D * 1000, S1: 138, S2: 200, E: 1, Rp: 355, Rm: 490, c: 1 });
    return Object.assign({}, v, g, { tDiv1: v.valid1 ? v.t1 : v.t1x, rule: v.valid1 ? 'ASME VIII-1 UG-27' : 'ASME VIII-1 App. 1-2 (thick wall)' });
  };
  // PED 2014/68/EU Annex II Table 1 (gases of group 1, vessels): category from PS·V
  H2.pedCategory = function (PS_bar, V_L) {
    if (V_L <= 1) return PS_bar > 1000 ? 'IV' : PS_bar > 200 ? 'III' : 'Art. 4(3)';
    const x = PS_bar * V_L; return x > 1000 ? 'IV' : x > 200 ? 'III' : x > 50 ? 'II' : x > 25 ? 'I' : 'Art. 4(3)';
  };
  /* NFPA 2 (2026) Table 7.3.2.3.1.1(a), bulk gaseous hydrogen, default pipe size – minimum separation in m by exposure group
     (1: lot lines, air intakes, openings, ignition sources; 2: exposed persons, parked cars, combustible buildings;
     3: non-combustible buildings, flammable-gas storage, utilities). Screening values – verify against the code edition in force. */
  H2.nfpa2Distances = function (p_bar) {
    const psig = Math.max(0, (p_bar - 1.013) * 14.5038);
    const T = [[250, 6.3, 5.7, 5.3], [3000, 7.5, 6.8, 6.2], [7500, 4.2, 3.8, 3.6], [15000, 5.5, 5.0, 4.6]];
    const r = T.find(t => psig <= t[0]) || T[T.length - 1], lo = [15, 250, 3000, 7500][T.indexOf(r)];
    return { psig, band: '> ' + lo + ' to ' + r[0] + ' psig', g1: r[1], g2: r[2], g3: r[3] };
  };
  // hydrogen-in-oxygen alarm and trip levels used by the design (industry practice; ISO 22734-1 requires a shutdown on unsafe composition)
  H2.GAS_ALARM = { alarm: 0.01, trip: 0.02 };

  /* ------------------------------------------------------------------
     2. Integrated plant designer: runs the whole chain, level by level
     ------------------------------------------------------------------ */
  H2.designPlant = function (b) {
    const S = []; // sections
    const sec = (title, level) => { const s = { title, level, rows: [], warn: [] }; S.push(s); return s; };
    const ov = H2.compModel ? H2.compModel(b) : {};                 // overrides from library components (none → presets)
    const etaR = ov.eta_rect || 0.97, kB = ov.k_BoP != null ? ov.k_BoP : 0.03, fB = ov.fixBoP != null ? ov.fixBoP : 0.01;
    const tp = Object.assign({}, own(H2.TECH, b.tech) || H2.TECH.AEL, ov.tp || {});
    const P = b.modules * b.moduleMW;         // MW
    const isl = b.supply === 'islanded', auxFrac = b.auxFrac != null ? b.auxFrac : 0.06;
    const nh3Y = (b.comp && b.comp.ammonia && b.comp.ammonia.p && b.comp.ammonia.p.eta) || H2.NH3.loop;
    const Tlt = H2.coolOutlet(b.Tamb), Tlim = b.Tdis || 120, gp = H2.gasProcessing(b.tech);
    // part-load pressure (PEM): the cathode pressure is lowered at part load where a compressor follows (storage above the stack pressure)
    const ppD = !tp.steam && b.storeP > (tp.pH2 || 1) - 1 ? H2.partPressure(tp, H2.GAS_ALARM.trip) : null;
    const sysOpts = { eta_rect: etaR, eta_trafo: 0.99, P_BoP_fixed_frac: fB, k_BoP: kB, soecHeat: b.soecHeat || 'electric', partPressure: !!ppD, xTrip: H2.GAS_ALARM.trip };
    // ---- Level 15: design basis & sizing chain
    let mH2_t; // hydrogen required, t/a
    let pl = null, wall = null, tr = null, nh3 = null, st = null, hf = null, la = null;
    if (b.product === 'NH3') mH2_t = b.demand * H2.NH3.h2 / nh3Y;
    else mH2_t = b.demand * 365 / 1000;       // kg/d -> t/a
    const s0 = sec('Design basis and sizing chain', 15);
    const cell = H2.cell(tp, tp.jnom);
    const lifeD = H2.stackLife(tp, cell.Ecell);                            // CM 6.6 replacement interval
    const prodF = 1 - gp.loss;                                             // product per kg leaving the stacks
    const SECest = H2.system(tp, 1000, Object.assign({ degr_frac: lifeD.degr_frac }, sysOpts)).nominal.SEC_sys / prodF;   // life average, per kg of product
    const chain = R('DM-1.1–1.5', { mprod: b.product === 'H2' ? mH2_t : b.demand, yield: b.product === 'H2' ? 1 : H2.NH3.h2 / nh3Y, avail: b.availability, SEC: SECest, FLH: b.FLH, c: b.curtail, FLHRE: Math.max(1, (b.pvMWp * b.pvYield + b.windMW * b.windFLH) / Math.max(b.pvMWp + b.windMW, 1e-9)), aux: P * auxFrac, wDI: b.wDI, Y: b.Y1 * b.Y2, aPV: 1.4, PVshare: b.pvMWp / Math.max(b.pvMWp + b.windMW, 1e-9) });
    s0.rows.push(['Hydrogen required (incl. availability)', chain.mH2, 't/a', 'DM 1.1'], ['Electrolyser capacity from chain', chain.Pely, 'MW', 'DM 1.2'],
      ['Selected electrolyser', P, 'MW', 'basis'], ['Renewable generation needed', chain.Ere, 'GWh/a', 'DM 1.3'], ['Raw water at full load', chain.Vraw, 'm³/h', 'DM 1.4'], ['Land (PV + plant)', chain.land, 'ha', 'DM 1.5']);
    if (chain.Pely > P * 1.10) s0.warn.push('Selected capacity is below the sizing-chain requirement – increase modules or FLH.');
    // ---- Level 1–2: cell
    const s1 = sec('Cell (thermodynamics and kinetics)', 2);
    s1.rows.push(['Operating temperature', tp.T_C, '°C', ''], ['Reversible voltage E_rev(T,p)', cell.Erev, 'V', 'CM 3.5/3.6'], ['Thermoneutral voltage E_tn', cell.Etn, 'V', 'CM 3.3'], ['Anode activation η_a', cell.eta_a, 'V', 'CM 4.5'],
      ['Cathode activation η_c', cell.eta_c, 'V', 'CM 4.5'], ['Ohmic loss j·ASR', cell.eta_ohm, 'V', 'CM 4.7'], ['Concentration loss', cell.eta_conc, 'V', 'CM 4.10'],
      ['Cell voltage at j_nom', cell.Ecell, 'V', 'CM 4.4'], ['Nominal current density', tp.jnom, 'A/cm²', ''], ['Faradaic efficiency', cell.etaF, '–', 'CM 7.6'],
      ['H₂ in O₂ at nominal', cell.xH2inO2 * 100, '%', 'CM 7.7'], ['Stack SEC', cell.SEC_stack, 'kWh/kg', 'CM 7.5'], ['η_HHV (stack)', cell.eff_HHV, '–', 'CM 3.8'], ['Heat per kg (+ released, − absorbed)', cell.q_heat_kWhkg, 'kWh/kg', 'CM 3.12']);
    // ---- Level 3: stack & power electronics
    const PDC = P * 1000 * 0.96;       // kW DC at rated (BoP share excluded)
    const area = R('CM-5.1', { P: PDC / 1000, j: tp.jnom, E: cell.Ecell, L: b.tech === 'PEM' ? 1.5 : 0 });
    const stack = R('CM-6.1', { A: tp.Acell, j: tp.jnom, E: cell.Ecell, N: tp.cells, etaF: cell.etaF, Pmod: b.moduleMW * 1000 * 0.96 });
    const rect = R('CM-6.3', { PDC: b.moduleMW * 1000 * 0.96, eta: etaR, k: 0.15, cosphi: 0.93 });
    const EEoL = cell.Ecell * (1 + lifeD.rise);
    const deg = { tEoL: lifeD.tRep, tEoL_a: lifeD.tRep / Math.max(b.FLH, 1), tDeg: lifeD.tEoL, EEoL, SEC0: C.kSEC * cell.Ecell / cell.etaF, SEC1: C.kSEC * EEoL / cell.etaF, SECavg: C.kSEC * cell.Ecell * (1 + lifeD.degr_frac) / cell.etaF, rise: lifeD.rise, limitedBy: lifeD.limitedBy };
    const sys = H2.system(tp, PDC, sysOpts);
    const sysAvg = H2.system(tp, PDC, Object.assign({ degr_frac: lifeD.degr_frac }, sysOpts));
    const s2 = sec('Stack, module and power supply', 3);
    s2.rows.push(['Total active area', area.A, 'm²', 'CM 5.1'], ['Catalyst (Ir for PEM)', area.mcat, 'kg', 'CM 5.1'], ['Stack current', stack.I, 'A', 'CM 6.1'], ['Stack voltage', stack.V, 'V', 'CM 6.1'],
      ['Stack power', stack.P, 'kW', 'CM 6.1'], ['Stacks per module', stack.Nst, '–', 'CM 6.1'], ['Stacks in plant', stack.Nst * b.modules, '–', ''], ['AC power per module', rect.PAC, 'kW', 'CM 6.3'],
      ['Transformer per module', rect.S, 'kVA', 'CM 6.3'], ['Stated stack life', tp.stackLife_h, 'h', 'basis'], ['Operating time to +10 % cell voltage', isFinite(lifeD.tEoL) ? lifeD.tEoL : 'no degradation', isFinite(lifeD.tEoL) ? 'h' : '', 'CM 6.6'],
      ['Stack replacement interval (' + lifeD.limitedBy + ')', lifeD.tRep, 'h', 'CM 6.6'], ['Replacement interval at design FLH', deg.tEoL_a, 'a', 'CM 6.6'], ['SEC begin / end of stack life', deg.SEC0.toFixed(1) + ' / ' + deg.SEC1.toFixed(1), 'kWh/kg', 'CM 6.6']);
    // ---- Level 4: system
    const nom = sys.nominal;
    const Lpur = tp.steam ? 0 : ppD ? ppD.Lmin : H2.purityMinLoad(tp, H2.GAS_ALARM.trip);
    const minBasis = b.minLoad != null ? b.minLoad : tp.minLoad, minEff = Math.max(minBasis, Lpur);
    const minL = sys.atLoad(Math.max(0.005, minEff));                                      // purity at the operating minimum load
    const SECsys = sysAvg.nominal.SEC_sys / prodF;                                         // life average, per kg of product
    const mdot = P * 1000 / SECsys;
    const mYear = mdot * b.FLH / 1000;
    const s3 = sec('System efficiency and balances', 4);
    s3.rows.push(['System SEC at rated (BoL, stack output)', nom.SEC_sys, 'kWh/kg', 'CM 6.4/7.8'], ['System SEC life average (product)', SECsys, 'kWh/kg', 'CM 6.6'], ['Gas-processing loss (deoxo + dryer)', 100 * gp.loss, '%', 'CM 8.4'],
      ['Minimum load: design basis / gas-purity limit', (100 * minBasis).toFixed(0) + ' % / ' + (100 * Lpur).toFixed(0) + ' %', '', 'CM 7.7'], ['System SEC at minimum load', minL.SEC_sys, 'kWh/kg', 'CM 7.8'],
      ppD ? ['Cathode pressure lowered below ' + (100 * ppD.Lnom).toFixed(0) + ' % load, down to', ppD.pPart + ' bar at ' + (100 * ppD.Lmin).toFixed(0) + ' %', '', 'CM 7.6'] : null,
      ['H₂ in O₂ at the operating minimum load', minL.xH2inO2 * 100, '%', 'CM 7.7'], ['Full-load production (product)', mdot, 'kg/h', 'CM 1.3'], ['Annual production', mYear, 't/a', 'CM 1.4'],
      ['System efficiency (LHV)', C.LHV / SECsys, '–', 'CM 7.5'], ['Oxygen by-product', mYear / prodF * C.w_O2, 't/a', 'CM 4.2']);
    s3.rows = s3.rows.filter(Boolean);
    if (Lpur > minBasis + 1e-9) s3.warn.push('Minimum load raised from ' + (100 * minBasis).toFixed(0) + ' % to ' + (100 * Lpur).toFixed(0) + ' %: below it hydrogen in oxygen reaches the ' + (100 * H2.GAS_ALARM.trip) + ' % trip (CM 7.7, DM 10.2). A recombiner or a thicker membrane would allow a lower load.');
    if (tp.steam) s3.rows.push(['Heat for steam raising (' + (sysOpts.soecHeat === 'external' ? 'external heat' : 'electric') + ')', 6.6, 'kWh/kg', 'CM 3.12'], ['Heat demand below E_tn at rated', C.kSEC * Math.max(0, cell.Etn - cell.Ecell), 'kWh/kg', 'CM 3.12']);
    if (mYear < mH2_t * 0.97) s3.warn.push('Annual production (' + mYear.toFixed(0) + ' t) is below the requirement (' + mH2_t.toFixed(0) + ' t).');
    // ---- Level 5: renewables
    const s4 = sec('Renewable supply', 5);
    const pv = R('DM-3.2', { GHI: b.GHI, tr: ov.pv ? ov.pv.tracking : (isl ? 1.25 : 1.12), losses: '0.02,0.05,0.02,0.015,0.02,0.03,0.01,0.03', P: b.pvMWp });
    const pv90 = R('DM-3.1', { E: pv.E, si: 0.045, sd: 0.035, sm: 0.03, z: 1.282 });
    const lay = R('DM-3.4', { P: b.pvMWp, Pm: ov.pv ? ov.pv.modW : 620, Voc: 50.5, beta: -0.0025, Tmin: 2, Vmax: 1500, r: ov.pv ? ov.pv.dcac : 1.25, S: 4.2, amod: 4.65, GCR: 0.36, finfra: 0.15 });
    const wind = R('CM-14.4', { vm: b.vmean, k: b.windK || 2, vin: ov.wind ? ov.wind.v_in : 3, vr: ov.wind ? ov.wind.v_rated : 12, vout: ov.wind ? ov.wind.v_out : 25, Pr: b.windMW });
    const wnet = R('DM-4.2', { CFg: wind.CF, lw: 0.07, la: 0.03, le: 0.02, lenv: 0.01, P: b.windMW });
    const Eely = P * b.FLH / 1000; // GWh
    const Eaux = P * auxFrac * 8760 / 1000;
    s4.rows.push(['PV performance ratio', pv.PR, '–', 'DM 3.2'], ['PV specific yield', pv.Y, 'kWh/kWp', 'DM 3.2'], ['PV energy P50', pv.E, 'GWh/a', 'DM 3.2'], ['PV energy P90', pv90.P90, 'GWh/a', 'DM 3.1'],
      ['PV modules / inverters', lay.Nmod + ' / ' + lay.Ninv, '–', 'DM 3.4'], ['PV land', lay.land, 'ha', 'DM 3.4'], ['Wind Weibull scale', wind.c, 'm/s', 'CM 14.4'], ['Wind net CF', wnet.CF, '–', 'DM 4.2'],
      ['Wind energy', wnet.E, 'GWh/a', 'DM 4.2'], ['Electrolyser consumption', Eely, 'GWh/a', 'CM 1.4'], ['Auxiliaries (' + (100 * auxFrac).toFixed(0) + ' % of rating)', Eaux, 'GWh/a', 'DM 1.6'], ['RE coverage of demand', (pv.E + wnet.E) / (Eely + Eaux), '–', '']);
    // ---- Level 6: water
    const s5 = sec('Water supply and treatment', 6);
    const w = R('DM-6.1', { m: mdot, w: b.wDI, Y1: b.Y1, Y2: b.Y2, cool: 0, other: 0 });
    const osm = R('DM-8.1', { cf: b.TDS, Y: b.Y1, Rs: 0.997 });
    const pf = Math.max(osm.pic * 1.15 + 5, 8);
    const ro = R('DM-8.4', { pf, ep: 0.8, Y: b.Y1, eERD: b.TDS > 10 ? 0.96 : 0, pb: pf - 1.5, dpl: 1.5 });
    const tank = R('DM-6.3', { DIf: w.DI, DIavg: w.DI * b.FLH / 8760, t: 12, Aw: 0.95, m: 0.15, day: 10, dead: 0.12 });
    const lcow = R('DM-8.10', { CAPEX: w.raw * 24 * (b.TDS > 10 ? 3500 : 1500) / 1e6, r: b.WACC, n: b.life, fix: 0.08, V: w.DI * b.FLH, SEC: ro.s1 / b.Y2 + 0.5, pel: b.pel / 1000, chem: 0.05, mem: 0.04, w: b.wDI });
    // in the LCOH: raw water bought + chemicals and membranes per m³ DI; the plant is in the other direct costs, its power in the auxiliaries
    const waterMEUR = (w.raw * b.FLH * (b.waterPrice || 0) + w.DI * b.FLH * 0.09) / 1e6;
    s5.rows.push(['DI water at full load', w.DI, 'm³/h', 'DM 6.1'], ['Overall recovery', w.Y, '–', 'DM 6.2'], ['Raw water at full load', w.raw, 'm³/h', 'DM 6.1'], ['Reject / brine', w.brine, 'm³/h', 'DM 6.1'],
      ['Feed osmotic pressure', osm.pif, 'bar', 'DM 8.1'], ['Concentrate TDS', osm.cc, 'g/L', 'DM 8.2'], ['RO feed pressure', pf, 'bar', 'DM 8.3'], ['RO HP energy (with ERD if seawater)', ro.s1, 'kWh/m³', 'DM 8.4/8.5'],
      ['DI tank', tank.V, 'm³', 'DM 6.3'], ['Levelised cost of water, stand-alone plant', lcow.LCOW, 'EUR/m³', 'DM 8.10'], ['Stand-alone water cost per kg H₂', lcow.perkg, 'EUR/kg', 'DM 8.10'], ['Water cost in the LCOH (raw water + chemicals)', waterMEUR * 1000 / Math.max(mYear, 1e-9), 'EUR/kg', 'DM 20.2']);
    // ---- Level 7: heat & cooling
    const s6 = sec('Heat and cooling', 7);
    const heat = R('DM-9.1', { P: PDC / 1000, E: cell.Ecell, etaF: cell.etaF, fg: 0.07, Etn: cell.Etn, fE: 1 + lifeD.rise });
    const Qcond = tp.steam ? mdot / prodF * C.w_H2O * (1 / 0.7 - 1) * 2257 / 3600 / 1000 : 0;   // SOEC: unconverted steam condensed (70 % utilisation)
    const Qtot = heat.QEoL * 1.15 + Qcond; // + power electronics, compressors
    const loop = H2.coolingLoop(tp);
    const dry = H2.dryCoolerDesign(Qtot, loop, b.Tamb);
    const ct = R('DM-9.4', { Q: Math.max(Qtot, 1e-6), hfg: 2450, COC: 4, drift: 0 });
    s6.rows.push(['Stack heat BoL', heat.Q, 'MW', 'DM 9.1'], ['Stack heat at end of stack life (+' + (100 * lifeD.rise).toFixed(1) + ' % V)', heat.QEoL, 'MW', 'DM 9.1'], tp.steam ? ['Stack heat demand (endothermic, BoL)', heat.Qin, 'MW', 'DM 9.1'] : null, tp.steam ? ['Steam condensers', Qcond, 'MW', 'CM 8.3'] : null, ['Design cooling duty', Qtot, 'MW', 'CM 8.5'],
      ['Coolant loop return → supply', loop.Tret + ' → ' + loop.Tsup + ' °C', '', 'DM 9.1'], ['Dry-cooler air in → out', dry.Tai.toFixed(0) + ' → ' + dry.Tao.toFixed(0) + ' °C', '', 'DM 9.3'], ['Dry-cooler ΔT_lm', dry.dTlm, 'K', 'DM 9.2'], ['Dry-cooler area', dry.A, 'm²', 'DM 9.2'], ['Fan power', dry.Pfan, 'kW', 'DM 9.3'], ['Evaporative alternative: make-up', ct.mk, 'm³/h', 'DM 9.4']);
    s6.rows = s6.rows.filter(Boolean);
    if (!dry.feasible) s6.warn.push('Design ambient ' + b.Tamb + ' °C is within 5 K of the coolant supply (' + loop.Tsup + ' °C): dry coolers alone cannot reject the heat – sized with adiabatic pre-cooling of the air to ' + dry.Tai.toFixed(0) + ' °C (DM 9.3).');
    // ---- Level 8: compression
    const s7 = sec('Compression and purification', 8);
    const p1c = Math.max(1.013, tp.pH2 - 1), esC = ov.cmp ? ov.cmp.etaS : H2.COMP_ETA.s, rT = H2.rmaxForT(Tlt, Tlim, esC), rC = Math.min(ov.cmp ? ov.cmp.rmax : 2.3, rT);
    const comp = b.storeP > p1c ? R('DM-12.1', { p1: p1c, p2: b.storeP, rmax: rC, T1: Tlt, es: esC, em: H2.COMP_ETA.mech * H2.COMP_ETA.motor, m: mdot })
      : { N: 0, r: 1, T2: Tlt, w: 0, P: 0, Q: 0, bypass: true };
    const deoxo = R('CM-8.4', { y: gp.yO2, m: mdot / prodF });
    const moist = R('CM-8.3', { T: Tlt, p: tp.pH2, m: mdot / prodF });
    s7.rows.push(['Suction pressure / temperature (after gas processing, intercoolers)', p1c.toFixed(1) + ' bar / ' + Tlt + ' °C', '', 'DM 12.1'], ['Discharge temperature limit', Tlim, '°C', 'API 618'], ['Largest stage ratio at the limit', rT, '–', 'DM 12.1'],
      ['Stages', comp.N, '–', 'DM 12.1'], ['Pressure ratio per stage', comp.r, '–', 'DM 12.1'], ['Stage discharge temperature', comp.T2, '°C', 'DM 12.1'], ['Specific energy', comp.w, 'kWh/kg', 'DM 12.2'],
      ['Compressor power', comp.P, 'kW', 'DM 12.2'], ['Intercooling duty', comp.Q, 'kW', 'DM 12.2'], ['Deoxo temperature rise (' + (100 * gp.yO2).toFixed(1) + ' % O₂)', deoxo.dT, 'K', 'CM 8.4'], ['Water in gas after cooler (' + Tlt + ' °C)', moist.mw, 'kg/h', 'CM 8.3']);
    if (comp.bypass) s7.warn.push('Storage pressure ' + b.storeP + ' bar is not above the gas-processing outlet (' + p1c.toFixed(1) + ' bar) – no compressor.');
    // ---- Level 9: storage
    const s8 = sec('Storage', 9);
    const m_st = mdot * 24 * b.storeDays * b.storeFrac; // kg usable
    const vol = R('DM-13.1', { mu: m_st, pmax: b.storeP, pmin: b.storePmin, T: 25 });
    const vessel = H2.vesselWall(b.storeP);
    s8.rows.push(['Usable buffer', m_st, 'kg', 'DM 13.1'], ['Pressure range', b.storePmin + '–' + b.storeP, 'bar', 'basis'], ['Density at p_max / p_min', vol.rmax.toFixed(2) + ' / ' + vol.rmin.toFixed(2), 'kg/m³', 'CM 2.4'], ['Geometric volume', vol.V, 'm³', 'DM 13.2'],
      ['Total inventory', vol.mtot, 'kg', 'CM 9.1'], ['Shell thickness, D = ' + vessel.D + ' m (' + vessel.rule + ')', vessel.tDiv1, 'mm', 'DM 13.3'], ['Shell thickness (ASME VIII-2 / EN 13445)', vessel.t2.toFixed(1) + ' / ' + vessel.e.toFixed(1), 'mm', 'DM 13.3/13.5'],
      ['PED 2014/68/EU category (group 1 gas)', H2.pedCategory(b.storeP * 1.1, vessel.V * 1000), '', 'PED Annex II']);
    // ---- Level 10: transport / delivery
    const s9 = sec('Transport and delivery', 10);
    if (b.deliver === 'pipeline' && b.pipeKm > 0) {
      const D = 0.1; pl = R('CM-13.1', { L: b.pipeKm, D, f: 0.018, Zm: 1.02, T: 15, p1: b.pipeP + 2, p2: b.pipeP });
      wall = H2.pipeWall(100, b.pipeP + 2);
      s9.rows.push(['Pipeline DN100 capacity (2 bar drop)', pl.m * 3600, 'kg/h', 'CM 13.1'], ['Inlet velocity', pl.u1, 'm/s', 'CM 13.1'], ['Wall B31.12 option A (F 0.5, H_f ' + wall.Hf.toFixed(3) + ') / EN 1594', wall.tA.toFixed(2) + ' / ' + wall.tE.toFixed(2), 'mm', 'DM 14.2'],
        ['Selected wall (≥ 6.4 mm, EIGA Doc 121)', wall.tSel, 'mm', 'DM 14.2'], ['Hoop stress at operating pressure', 100 * wall.hoopFrac, '% SMYS', 'EIGA Doc 121']);
      if (pl.m * 3600 < mdot) s9.warn.push('DN100 too small for full-load flow – increase diameter.');
    }
    if (b.trailer_kgd > 0) {
      tr = R('DM-14.3', { m: b.trailer_kgd, mp: 1100, mc: 60, tr: 2.5, tu: 48, sp: 1 });
      s9.rows.push(['Trailer trips per day', tr.n, '–', 'DM 14.3'], ['Trailers required', tr.N, '–', 'DM 14.3']);
    }
    if (b.deliver === 'ammonia') s9.rows.push(['Delivery', 'ammonia by ship (see end use)', '', '']);
    if (b.deliver === 'hrs') s9.rows.push(['Delivery', 'on-site dispensing (see end use)', '', '']);
    // ---- Level 11: end use
    const s10 = sec('End use / Power-to-X', 11);
    let productNote = '';
    if (b.product === 'NH3') {
      nh3 = R('DM-15.3', { mNH3: b.demand / 8000, eta: nh3Y, eASU: 0.12, wH2: 1, wN2: 0.14, eloop: 0.12 });
      s10.rows.push(['Ammonia rate (8000 h)', b.demand / 8000, 't/h', 'DM 15.2'], ['Hydrogen to loop', nh3.mH2, 't/h', 'DM 15.2'], ['Nitrogen (ASU)', nh3.mN2, 't/h', 'DM 15.2'], ['Synthesis electricity', nh3.E, 'MWh/t NH₃', 'DM 15.3'], ['Reaction heat', nh3.Q, 'MW', 'DM 15.1']);
      productNote = 'NH3';
    } else if (b.deliver === 'hrs') {
      st = R('DM-16.1', { m: b.demand, fp: 0.12, top: 20, mg: 0.25, nb: 6, mf: 5, tb: 0.5, cp: 14.3, Tin: 25, Tout: -40, COP: 1.2 });
      hf = R('DM-16.3', { NWP: 700, T: 85 });
      s10.rows.push(['Peak-hour demand', st.peak, 'kg/h', 'DM 16.1'], ['Station compressor', st.comp, 'kg/h', 'DM 16.1'], ['Cascade mass', st.casc, 'kg', 'DM 16.1'], ['Pre-cooling energy', st.Epc, 'kWh/kg', 'DM 16.2'], ['Hot-fill end pressure (85 °C)', hf.p, 'bar', 'DM 16.3'], ['Cars per day (5 kg)', b.demand / 5, '–', '']);
    } else {
      s10.rows.push(['Industrial offtake', b.demand, 'kg/d', 'basis'], ['Equivalent natural gas replaced (LHV)', mYear * C.LHV / 1000, 'GWh/a', 'CM 1.2']);
    }
    // ---- Level 12: economics
    const s11 = sec('Economics', 12);
    const elyCap = P * 1000 * b.capexEly / 1e6;
    const direct = elyCap * (1 + b.otherCapexFrac) + (isl ? b.pvMWp * (b.pvCapex || 0) / 1000 + b.windMW * (b.windCapex || 0) / 1000 : 0);
    const cap = R('DM-20.1', { direct: String(direct), fi: 0.12, fc: 0.10, fo: 0.04, P });
    const Eel = (Eely + Eaux + comp.P * b.FLH / 1e6); // GWh
    const pelEff = isl ? 0 : b.pel;
    // replacements before the end of life: stacks every t_rep (at the design FLH), battery and power electronics at their lives
    const disc = y => Math.pow(1 + b.WACC, -y);
    let PVst = 0, nSt = 0; for (let k = 1; k <= 200; k++) { const yr = k * lifeD.tRep / Math.max(b.FLH, 1); if (yr >= b.life - 1e-9) break; nSt++; PVst += elyCap * b.stackFrac * disc(yr); }
    const others = H2.replacementItems ? H2.replacementItems(b, elyCap) : [];
    let PVoth = 0; others.forEach(r => { for (let yr = r.life; yr < b.life - 1e-9; yr += r.life) PVoth += r.capex * disc(yr); });
    const heatMEUR = tp.steam && sysOpts.soecHeat === 'external' ? mYear / prodF * 6.6 * (b.heatPrice || 0) / 1e6 : 0;   // 6.6 MWh of steam heat per t H₂
    const lc = R('DM-20.2', { CAPEX: cap.CAPEX, r: b.WACC, n: b.life, st: PVst + PVoth, sy: 0, fix: b.fixedOpexFrac * cap.CAPEX + heatMEUR, E: Eel, pel: pelEff, cw: waterMEUR, by: 0, m: mYear, target: 5 });
    s11.rows.push(['Direct costs', cap.D, 'MEUR', 'DM 20.1'], ['Total CAPEX', cap.CAPEX, 'MEUR', 'DM 20.1'], ['Specific CAPEX', cap.spec, 'EUR/kW', 'DM 20.1'], ['CRF', lc.CRF, '1/a', 'CM 17.1'],
      ['Stack replacements in life (at design FLH)', nSt, '–', 'CM 6.6'], ['Replacements, present value', lc.PVst, 'MEUR', 'DM 20.2'], heatMEUR > 0 ? ['External heat for steam', heatMEUR, 'MEUR/a', ''] : null,
      ['Annual cost', lc.tot, 'MEUR/a', 'DM 20.2'], ['LCOH', lc.LCOH, 'EUR/kg', 'DM 20.2'], ['of which capital', lc.cap, 'EUR/kg', 'DM 20.2'], ['of which electricity', lc.el, 'EUR/kg', 'DM 20.2']);
    s11.rows = s11.rows.filter(Boolean);
    if (b.product === 'NH3') { la = R('CM-17.6', { LCOH: lc.LCOH, Csyn: 1650, CRF: lc.CRF, fOM: 0.03, CF: 0.95, esyn: 0.6, pel: b.pel }); s11.rows.push(['Levelised cost of ammonia', la.LCOA, 'EUR/t', 'CM 17.6']); }
    // ---- Level 13: environment
    const s12 = sec('Environment and certification', 13);
    const gridShare = isl ? 0 : 1 - b.ppaShare;
    // RFNBO method (Delegated Reg. (EU) 2023/1185): renewable electricity at zero, grid at its emission factor, no equipment emissions
    const ci = R('CM-18.1', { CIel: gridShare * b.gridCI, SEC: SECsys, emb: 0, thr: 3.38 });
    const leak = R('CM-18.3', { l: 0.01, GWP: 11.6, CI: ci.CI });
    const ab = R('CM-18.2', { Lg: lc.LCOH, Lr: 2.0, CIr: 10, CIg: leak.tot, m: mYear });
    s12.rows.push(['Grid share of electricity (sizing estimate)', gridShare, '–', 'basis'], ['GHG intensity, RFNBO method (sizing estimate)', ci.CI, 'kg CO₂e/kg', 'CM 18.1'], ['RFNBO threshold 3.38 kg/kg (70 % saving) met', ci.ok ? 'yes' : 'NO', '', '2023/1185'],
      ['Delivered CI incl. 1 % leakage', leak.tot, 'kg CO₂e/kg', 'CM 18.3'], ['CO₂ avoided vs grey (10 kg/kg)', ab.dCO2, 't/a', 'CM 18.2'], ['Abatement cost', ab.c, 'EUR/t CO₂', 'CM 18.2']);
    if (!ci.ok) s12.warn.push('GHG intensity above the EU RFNBO threshold – reduce the grid share.');
    // ---- Level 14: safety
    const s13 = sec('Safety engineering', 14);
    const rel = R('CM-19.1', { d: 3, p: b.storeP, T: 20, Cd: 0.85 });
    const jet = R('CM-19.5', { d: 3, rho0: rel.rho0, m: rel.m / 1000 });
    const rad = R('CM-19.6', { chi: 0.1, tau: 0.8, m: rel.m / 1000, q: 4.7 });
    const radC = jet.Lf / 2 + rad.r;                                                     // from the leak: flame centre + point-source radius
    const blast = R('CM-19.8', { m: Math.min(vol.mtot, H2.BLAST_MASS_MAX), ey: 0.1, R: 30, dp: 10 });
    const nfpa = H2.nfpa2Distances(b.storeP);
    const vent = R('DM-11.2', { A: Math.max(200, P * 60), m: 0.001, k: 0.5, cL: 0.00335, T: 293, f: 3, Vroom: Math.max(200, P * 60) * 10, ach: 5 });
    const purge = R('DM-10.3', { c0: 21, ct: 1, V: P * 0.5 + 1, pp: 1, p1: 6, p2: 1.2 });
    s13.rows.push(['3 mm leak at storage pressure', rel.m, 'g/s', 'CM 19.1'], ['Distance to LFL', jet.xLFL, 'm', 'CM 19.5'], ['Jet-flame length', jet.Lf, 'm', 'CM 19.5'], ['Distance to 4.7 kW/m² (from the leak, flame centre + r)', radC, 'm', 'CM 19.5/19.6'],
      ['Distance to 10 kPa (≤ ' + H2.BLAST_MASS_MAX + ' kg, 10 % yield)', blast.Rdp, 'm', 'CM 19.8'], ['NFPA 2 separation, exposure group 1 / 2 / 3', nfpa.g1 + ' / ' + nfpa.g2 + ' / ' + nfpa.g3, 'm', 'NFPA 2 (2026)'],
      ['Hall ventilation NFPA 2', vent.VN, 'm³/s', 'DM 11.2'], ['Hall ventilation IEC', vent.VI, 'm³/s', 'DM 11.2'], ['N₂ purge (≥5 volumes)', purge.VN2, 'Nm³', 'DM 10.3'],
      ['Gas analysers H₂ in O₂ / O₂ in H₂: alarm / trip', 100 * H2.GAS_ALARM.alarm + ' / ' + 100 * H2.GAS_ALARM.trip, 'vol-%', 'ISO 22734-1']);
    const data = { tp, chain, cell, area, stack, rect, deg, lifeD, sys, sysAvg, nom, minL, minBasis, minEff, Lpur, SECsys, mdot, mYear, mH2_t, PDC, pv, pv90, lay, wind, wnet, Eely, Eaux, w, osm, pf, ro, tank, lcow, waterMEUR, heat, Qtot, Qcond, loop, dry, ct, comp, p1c, Tlt, Tlim, rT, deoxo, moist, m_st, vol, vessel, pl, wall, tr, nh3, st, hf, cap, Eel, lc, la, ci, leak, ab, rel, jet, rad, radC, blast, nfpa, vent, purge, elyCap, gridShare, gp, nh3Y };
    return { sections: S, kpi: { P, mdot, mYear, SECsys, LCOH: lc.LCOH, CAPEX: cap.CAPEX, CI: ci.CI, water: w.raw, Ecell: cell.Ecell, productNote }, data };
  };

  /* ------------------------------------------------------------------
     3. Flowsheet (model builder) blocks
     stream: {H2_ta, mdot_kgh, p_bar, E_GWh, P_MW, capex, opex, water_m3a, CO2_t, product, notes[]}
     ------------------------------------------------------------------ */
  const B = H2.BLOCKS = {};
  function blk(type, label, level, color, params, run, desc) { B[type] = { type, label, level, color, params, run, desc }; }
  blk('supply', 'Power supply (PV / wind / grid)', 5, '#e0a800',
    [['pv', 'PV capacity', 'MWp', 180], ['wind', 'Wind capacity', 'MW', 60], ['bat', 'Battery power', 'MW', 30], ['batE', 'Battery energy', 'MWh', 60], ['grid', 'Grid import limit', 'MW', 0], ['gridCI', 'Grid CI', 'g/kWh', 300], ['gridPrice', 'Grid price', 'EUR/MWh', 80], ['gridMode', 'Grid use (fill = bridge to min load, full = top up to rated)', '', 'fill'],
      ['GHI', 'Annual GHI', 'kWh/m²', 2200], ['lat', 'Latitude', '°', 29], ['v', 'Mean wind at hub', 'm/s', 8.6], ['track', 'Tracking gain', '–', 1.25], ['seed', 'Weather seed', '–', 7]],
    (s, p) => {
      ['pv', 'wind', 'bat', 'batE', 'grid', 'gridCI', 'gridPrice'].forEach(k => { if (!(p[k] >= 0)) throw new Error(k + ' must be zero or positive'); });
      if (!(p.GHI >= 300 && p.GHI <= 3000)) throw new Error('the annual GHI must lie between 300 and 3 000 kWh/m²'); if (!(p.lat >= -66 && p.lat <= 66)) throw new Error('the latitude must lie between −66° and 66°');
      if (!(p.v >= 0 && p.v <= 20)) throw new Error('the mean wind speed must lie between 0 and 20 m/s'); if (!(p.track >= 1 && p.track <= 1.6)) throw new Error('the tracking gain must lie between 1 and 1.6');
      s.supply = p; s.notes.push('Supply defined: ' + p.pv + ' MWp PV, ' + p.wind + ' MW wind, battery ' + p.bat + ' MW/' + p.batE + ' MWh, grid ' + p.grid + ' MW.'); return s; },
    'Defines the hourly renewable/grid supply used by the next Electrolyser block (synthetic typical year).');
  blk('water', 'Water treatment (RO + polishing)', 6, '#1f8fd6',
    [['TDS', 'Feed TDS', 'g/L', 41], ['Y1', 'First-pass recovery', '–', 0.42], ['Y2', 'Second-pass recovery', '–', 0.9], ['wDI', 'DI per kg H₂', 'L/kg', 10.5], ['price', 'Raw water price', 'EUR/m³', 0.3], ['capex', 'CAPEX', 'EUR per m³/d', 3500]],
    (s, p) => { if (!(p.Y1 > 0 && p.Y1 < 1 && p.Y2 > 0 && p.Y2 <= 1)) throw new Error('the recoveries must lie between 0 and 1'); if (!(p.wDI > 0)) throw new Error('the DI water per kg must be positive');
      s.waterCfg = p; if (p._w) p._w.src = p._src; s.notes.push('Water train set: feed ' + p.TDS + ' g/L, overall recovery ' + (p.Y1 * p.Y2 / (1 - p.Y1 * (1 - p.Y2))).toFixed(3) + ' (DM 6.2).'); return s; },
    'Treatment train applied to the electrolyser water demand (DM 6.1, 8.1–8.5, 8.10).');
  blk('electrolyser', 'Electrolyser plant', 4, '#2e9d5b',
    [['tech', 'Technology (PEM/AEL/AEM/SOEC)', '', 'AEL'], ['P', 'Rated power', 'MW', 100], ['minLoad', 'Minimum load', '–', 0.2], ['capex', 'System CAPEX', 'EUR/kW', 1000], ['aux', 'Auxiliaries', 'MW', 6], ['avail', 'Availability', '–', 0.95], ['T', 'Stack temperature (blank = preset)', '°C', ''], ['p', 'Cathode pressure (blank = preset)', 'bar', '']],
    (s, p) => {
      if (!own(H2.TECH, p.tech)) throw new Error('unknown technology "' + String(p.tech).slice(0, 24) + '" – use PEM, AEL, AEM or SOEC');
      if (!(p.P > 0 && p.P <= 1e5)) throw new Error('the rated power must lie between 0 and 100 000 MW');
      if (!(p.minLoad >= 0 && p.minLoad < 1)) throw new Error('the minimum load must lie between 0 and 1');
      if (!(p.capex >= 0) || !(p.aux >= 0)) throw new Error('CAPEX and auxiliary load cannot be negative');
      const av = p.avail === '' || p.avail == null ? 0.95 : +p.avail; if (!(av >= 0.5 && av <= 1)) throw new Error('the availability must lie between 0.5 and 1');
      const cfg = H2.defaultHourly(); const sp = s.supply || { pv: 0, wind: 0, bat: 0, batE: 0, grid: p.P * 1.2, gridCI: 300, gridPrice: 80, GHI: 1800, lat: 35, v: 7, track: 1, seed: 1 };
      cfg.weather = Object.assign(cfg.weather, { lat: sp.lat, GHI_annual: sp.GHI, v_mean: sp.v, seed: sp.seed });
      cfg.pv.P_MWp = sp.pv; cfg.pv.tracking = sp.track; cfg.wind.P_MW = sp.wind; cfg.battery.P_MW = sp.bat; cfg.battery.E_MWh = sp.batE;
      cfg.grid = { enabled: sp.grid > 0, import_MW: sp.grid, price_EURMWh: sp.gridPrice, CI_gkWh: sp.gridCI, mode: sp.pv + sp.wind > 0 ? (sp.gridMode || 'fill') : 'full' };
      cfg.ely.tech = p.tech; cfg.ely.P_MW = p.P; cfg.ely.modules = Math.max(1, Math.round(p.P / 5)); cfg.ely.minLoad = p.minLoad; cfg.ely.capex_EURkW = p.capex; cfg.ely.availability = av; cfg.aux.P_MW = p.aux;
      // stack temperature / pressure overrides and component data (library)
      const tpo = Object.assign({}, p._tp || {}); if (p.T !== '' && p.T != null && isFinite(+p.T)) tpo.T_C = +p.T; if (p.p !== '' && p.p != null && isFinite(+p.p)) tpo.pH2 = +p.p;
      if (tpo.pH2 != null && !(tpo.pH2 >= 1 && tpo.pH2 <= 200)) throw new Error('the cathode pressure must lie between 1 and 200 bar');
      const steam = H2.TECH[p.tech].steam; if (tpo.T_C != null && !(steam ? tpo.T_C >= 500 && tpo.T_C <= 1000 : tpo.T_C > 0 && tpo.T_C <= 100)) throw new Error('the stack temperature must lie between ' + (steam ? '500 and 1 000' : '0 and 100') + ' °C for ' + p.tech);
      if (Object.keys(tpo).length) cfg.ely.tp = tpo;
      if (p._ely) { cfg.ely.eta_rect = p._ely.eta_rect; cfg.ely.k_BoP = p._ely.k_BoP; cfg.ely.BoP_fixed_frac = p._ely.BoP_fixed_frac; cfg.ely.stack_frac = p._ely.stack_frac; cfg.ely.om_frac = p._ely.om_frac; }
      if (sp._pv) Object.assign(cfg.pv, sp._pv); if (sp._wind) Object.assign(cfg.wind, sp._wind); if (sp._bat) Object.assign(cfg.battery, sp._bat);
      cfg.storage.enabled = false; cfg.econ.other_capex_MEUR = 0; cfg.econ.fixed_opex_MEUR = 0;
      if (s.waterCfg) { cfg.water.w_DI = s.waterCfg.wDI; cfg.water.Y = s.waterCfg.Y1 * s.waterCfg.Y2 / (1 - s.waterCfg.Y1 * (1 - s.waterCfg.Y2)); cfg.water.price_EURm3 = s.waterCfg.price; }
      const r = H2.hourly(cfg); s.hourly = r;
      const pH2 = tpo.pH2 != null ? tpo.pH2 : H2.TECH[p.tech].pH2;
      s.H2_ta = r.kpi.H2_t; s.mdot_kgh = r.kpi.H2_t * 1000 / 8760; s.mdot_peak = r.kpi.Pmax_kW / r.kpi.SEC_avg; s.p_bar = Math.max(1.013, pH2 - 1); s.T_C = 40;   // after gas processing (1 bar drop)
      const Esup = r.kpi.E_ely_GWh + r.kpi.E_aux_GWh + r.kpi.E_standby_GWh;      // dispatched electricity (auxiliaries as simulated)
      s.E_GWh += Esup; s.gridGWh = r.kpi.E_grid_GWh; s.gridCI = sp.gridCI;
      const reCap = r.capex.PV + r.capex.Wind + r.capex.Battery;
      s.capex += reCap + r.capex.Electrolyser; s.opex += r.kpi.opex_MEUR + r.kpi.elec_MEUR + r.kpi.heat_MEUR; s.stackPV = r.kpi.PVstacks_MEUR + r.kpi.PVrepl_MEUR;
      // electricity of the blocks downstream is costed at the average cost of this supply and carries its emission factor
      const ED = H2.ECON_DEFAULTS, reOM = r.capex.PV * (cfg.pv.om_frac || 0) + r.capex.Wind * (cfg.wind.om_frac || 0) + r.capex.Battery * (cfg.battery.om_frac || 0);
      s.elecPrice = Esup > 0 ? (H2.CRF(ED.WACC, ED.life) * reCap + reOM + r.kpi.elec_MEUR) * 1000 / Esup : 0;   // EUR/MWh
      s.elecCI = Esup > 0 ? r.kpi.E_grid_GWh * (sp.gridCI || 0) / Esup : 0;                                          // g/kWh
      s.water_m3a = r.kpi.V_raw_m3a; s.O2_ta = r.kpi.H2_stack_t * C.w_O2; s.product = 'H₂';
      s.ely = { tech: p.tech, P: p.P, minLoad: p.minLoad, minLoadEff: r.kpi.minLoad_eff, tp: tpo, ely: p._ely || null, stackRepl: r.kpi.stack_replacements, PH2_MW: r.kpi.Pmax_kW / r.kpi.SEC_avg * C.LHV / 1000, site: { v: sp.v, GHI: sp.GHI } };
      // inventory of the equipment (for the impact assessment)
      const it = (slot, size, capex, om) => { if (size > 0 || capex > 0) s.items.push({ slot, size, capex, om: om || 0 }); };
      it('pv', sp.pv, r.capex.PV, r.capex.PV * (cfg.pv.om_frac || 0)); it('wind', sp.wind, r.capex.Wind, r.capex.Wind * (cfg.wind.om_frac || 0)); if (sp.batE > 0) it('battery', sp.bat, r.capex.Battery, r.capex.Battery * (cfg.battery.om_frac || 0));
      const sh = (p._ely && p._ely.shares) || (H2.libDefault ? (() => { const a = [H2.libDefault('stack', { tech: p.tech }), H2.libDefault('psu', { tech: p.tech }), H2.libDefault('bop', { tech: p.tech })].map(x => x ? x.capex : 1); const sf = cfg.ely.stack_frac, t = a[1] + a[2]; return [sf, (1 - sf) * a[1] / t, (1 - sf) * a[2] / t]; })() : [0.3, 0.2, 0.5]);
      const eOM = r.capex.Electrolyser * (cfg.ely.om_frac || 0);
      it('stack', p.P, r.capex.Electrolyser * sh[0], eOM * sh[0]); it('psu', p.P, r.capex.Electrolyser * sh[1], eOM * sh[1]); it('bop', p.P, r.capex.Electrolyser * sh[2], eOM * sh[2]);
      if (s.waterCfg) { const wc = s.waterCfg, cap_m3d = r.kpi.V_raw_m3a / 365 * (8760 / Math.max(r.kpi.FLH, 1)), wCap = cap_m3d * wc.capex / 1e6, Ew = r.kpi.V_raw_m3a * (wc._w ? wc._w.sec : 4) / 1e6;
        s.capex += wCap; s.opex += r.kpi.V_raw_m3a * wc.price / 1e6; s.E_GWh += Ew; s.E_down_GWh = (s.E_down_GWh || 0) + Ew;
        const wOM = wc._w ? wCap * wc._w.om : 0; s.opex += wOM; it('water', cap_m3d, wCap, wOM); s.waterSrc = wc._w ? wc._w.src : (wc.TDS > 10 ? 'sea' : wc.TDS > 2 ? 'brackish' : 'fresh'); s.brine_m3a = r.kpi.V_raw_m3a - r.kpi.V_DI_m3a; s.waterTDS = wc.TDS; }
      s.notes.push('Hourly simulation: CF ' + r.kpi.CF.toFixed(3) + ', FLH ' + r.kpi.FLH.toFixed(0) + ' h, ' + r.kpi.H2_t.toFixed(0) + ' t/a after gas processing, SEC ' + r.kpi.SEC_avg.toFixed(1) + ' kWh/kg, curtailment ' + (100 * r.kpi.curt_share).toFixed(1) + ' %, ' + r.kpi.starts + ' starts, stack replaced every ' + Math.round(r.kpi.t_rep_h) + ' h (CM 6.6).');
      if (r.kpi.minLoad_eff > p.minLoad + 1e-6) s.notes.push('Minimum load raised from ' + (100 * p.minLoad).toFixed(0) + ' % to ' + (100 * r.kpi.minLoad_eff).toFixed(0) + ' %: below it hydrogen in oxygen reaches the 2 % trip (CM 7.7, DM 10.2).');
      return s; }, 'Runs the 8760-h dispatch model (DM Fig. 4.2) with the cell-level polarisation model of the chosen technology.');
  // downstream electricity of a block (supplied at the average cost of the chain's supply, see chainEcon)
  const addDown = (s, E) => { s.E_GWh += E; s.E_down_GWh = (s.E_down_GWh || 0) + E; };
  blk('compressor', 'Compressor', 8, '#8a5cd6',
    [['p2', 'Discharge pressure', 'bar', 250], ['rmax', 'Max ratio per stage', '–', 2.3], ['eta', 'Isentropic efficiency', '–', 0.75], ['Tdis', 'Discharge temperature limit (API 618)', '°C', 120], ['capex', 'CAPEX', 'EUR/kW', 3000]],
    (s, p) => { if (!(p.p2 > 0 && p.p2 <= 1100)) throw new Error('the discharge pressure must lie between 0 and 1 100 bar'); if (p.p2 <= s.p_bar) { s.notes.push('Compressor: discharge ' + p.p2 + ' bar ≤ stream pressure ' + s.p_bar + ' bar – no compression needed (block bypassed).'); return s; }
      if (!(p.rmax > 1)) throw new Error('the ratio per stage must be greater than 1'); if (!(p.eta > 0 && p.eta <= 1)) throw new Error('the isentropic efficiency must lie between 0 and 1');
      const T1 = 40, Tlim = p.Tdis > T1 ? p.Tdis : 120, r = Math.min(p.rmax, H2.rmaxForT(T1, Tlim, p.eta));
      const c = H2.compress(s.p_bar, p.p2, T1, { rmax: r, eta_s: p.eta, eta_mech: H2.COMP_ETA.mech, eta_motor: H2.COMP_ETA.motor, mdot_kgh: s.mdot_peak || s.mdot_kgh }); const E = s.H2_ta * c.SEC_kWhkg / 1000;
      addDown(s, E); s.capex += c.P_kW * p.capex / 1e6; s.opex += c.P_kW * p.capex / 1e6 * (p._om != null ? p._om : 0.04); s.compSEC = (s.compSEC || 0) + c.SEC_kWhkg;
      s.items.push({ slot: 'compressor', size: c.P_kW, capex: c.P_kW * p.capex / 1e6, om: c.P_kW * p.capex / 1e6 * (p._om != null ? p._om : 0.04) }); (s.comps = s.comps || []).push({ p1: s.p_bar, p2: p.p2, T2: c.T2_C, Tlim, P: c.P_kW, m: s.mdot_peak || s.mdot_kgh, N: c.N }); s.p_bar = p.p2;
      s.notes.push('Compressor: ' + c.N + ' stages, r = ' + c.r.toFixed(2) + ' (T₂ ≤ ' + Tlim + ' °C, API 618), ' + c.SEC_kWhkg.toFixed(2) + ' kWh/kg, ' + c.P_kW.toFixed(0) + ' kW, T₂ = ' + c.T2_C.toFixed(0) + ' °C (CM 10.4/10.5).'); return s; },
    'Multistage intercooled compression from the stream pressure (CM 10.4, DM 12.1); the stage ratio respects the discharge-temperature limit.');
  blk('storage', 'Compressed storage buffer', 9, '#c0392b',
    [['mode', 'Sizing (hourly/days)', '', 'hourly'], ['flex', 'Offtake averaging window (0 = flat)', 'h', 168], ['turndown', 'Offtake turndown', '–', 0.3], ['days', 'Days of average flow (if days)', 'd', 1], ['pmin', 'Minimum pressure', 'bar', 30], ['capex', 'Cost', 'EUR/kg usable', 600]],
    (s, p) => { if (!(p.pmin > 0)) throw new Error('the minimum pressure must be positive'); if (!(p.days >= 0) || !(p.flex >= 0 && p.flex <= 8760) || !(p.turndown >= 0 && p.turndown <= 1)) throw new Error('days, averaging window (0–8 760 h) and turndown (0–1) are out of range');
      let mu; if (p.mode === 'hourly' && s.hourly) { mu = H2.buffer(s.hourly.series.h2, p.flex, p.turndown, 1.2).usable; }
      else mu = s.mdot_kgh * 24 * p.days;
      if (s.p_bar <= p.pmin) { s.notes.push('⚠ Storage: stream pressure ' + s.p_bar + ' bar must exceed the minimum storage pressure ' + p.pmin + ' bar – add a compressor before the storage block.'); return s; }
      const V = mu / (H2.rho(s.p_bar, K(25)) - H2.rho(p.pmin, K(25))); s.capex += mu * p.capex / 1e6; s.opex += mu * p.capex / 1e6 * (p._om != null ? p._om : 0.02); s.storage_kg = mu;
      s.items.push({ slot: 'storage', size: mu, capex: mu * p.capex / 1e6, om: mu * p.capex / 1e6 * (p._om != null ? p._om : 0.02) }); s.store = { usable: mu, pmax: s.p_bar, pmin: p.pmin, V, mtot: V * H2.rho(s.p_bar, K(25)) };
      s.notes.push('Storage: usable ' + (mu / 1000).toFixed(1) + ' t, volume ' + V.toFixed(0) + ' m³ at ' + s.p_bar + '/' + p.pmin + ' bar (DM 13.1/13.2).'); s.p_bar = p.pmin; return s; },
    'Buffer between variable production and a flat offtake (CM 14.7, DM 13.1/13.2).');
  blk('pipeline', 'Pipeline', 10, '#34495e',
    [['L', 'Length', 'km', 50], ['D', 'Inner diameter', 'm', 0.3], ['p2', 'Delivery pressure', 'bar', 20], ['capex', 'Cost', 'MEUR/km', 1.2]],
    (s, p) => { if (!(p.L >= 0 && p.D > 0)) throw new Error('length and diameter must be positive'); const pin = s.p_bar; let out = {}; try { out = R('CM-13.1', { L: p.L, D: p.D, f: 0.013, Zm: 1.02, T: 15, p1: pin, p2: p.p2 }); } catch (e) { out = { m: 0 }; }
      const cap = out.m * 3600; s.capex += p.L * p.capex; s.opex += p.L * p.capex * (p._om != null ? p._om : 0.01); s.pipe = { L: p.L, D: p.D, cap, flow: s.mdot_peak || s.mdot_kgh, pin }; s.p_bar = p.p2; s.H2_ta *= (1 - 0.0001 * p.L / 100);
      s.items.push({ slot: 'pipeline', size: p.L, capex: p.L * p.capex, om: p.L * p.capex * (p._om != null ? p._om : 0.01) });
      s.notes.push('Pipeline ' + p.L + ' km DN' + (p.D * 1000).toFixed(0) + ': capacity ' + cap.toFixed(0) + ' kg/h vs. demand ' + (s.mdot_peak || s.mdot_kgh).toFixed(0) + ' kg/h (CM 13.1).' + (cap < (s.mdot_kgh || 0) ? ' ⚠ undersized' : '')); return s; },
    'Isothermal steady flow (CM 13.1) with the stream pressure as inlet.');
  blk('trailer', 'Tube-trailer delivery', 10, '#7f8c8d',
    [['d', 'One-way distance', 'km', 150], ['payload', 'Payload', 'kg', 1000], ['trailerCost', 'Trailer cost', 'MEUR', 0.9], ['cyc', 'Cycle time', 'h', 10]],
    (s, p) => { if (!(p.payload > 0)) throw new Error('the payload must be positive'); if (!(p.d >= 0 && p.cyc > 0)) throw new Error('distance and cycle time must be positive');
      const r = R('CM-13.3', { m: s.H2_ta * 1000 / 365, mu: p.payload, d: p.d, cyc: p.cyc, c: 35, LHVd: 35.9, CO2: 2.65 }); s.capex += r.trailers * p.trailerCost + 0.5; s.opex += r.trips * 365 * 2 * p.d * 1.5 / 1e6; s.CO2_t += r.co2 * s.H2_ta;
      s.items.push({ slot: 'trailer', size: r.trailers, capex: r.trailers * p.trailerCost + 0.5, om: 0 }); s.drivers = r.trips * p.cyc * 365 / (8 * 220); s.trailerP = s.p_bar;
      s.notes.push('Trailers: ' + r.trips + ' trips/d, ' + r.trailers + ' trailers, diesel ' + r.e.toFixed(1) + ' MJ/kg, ' + r.co2.toFixed(2) + ' kg CO₂/kg (CM 13.3).'); return s; }, 'Road transport of compressed hydrogen (CM 13.3, DM 14.3).');
  blk('ammonia', 'Ammonia synthesis (Haber–Bosch)', 11, '#16a085',
    [['eta', 'Loop yield', '–', 0.97], ['eASU', 'ASU energy', 'kWh/kg N₂', 0.12], ['eloop', 'Loop energy', 'kWh/kg NH₃', 0.12], ['capex', 'CAPEX', 'EUR per t/a', 1650]],
    (s, p) => { if (!(p.eta > 0 && p.eta <= 1)) throw new Error('the loop yield must lie between 0 and 1'); const nh3 = s.H2_ta * p.eta / H2.NH3.h2; const r = R('DM-15.3', { mNH3: nh3 / 8000, eta: p.eta, eASU: p.eASU, wH2: 1, wN2: 0.14, eloop: p.eloop });
      addDown(s, r.E * nh3 / 1000); s.capex += nh3 * p.capex / 1e6; s.opex += nh3 * p.capex / 1e6 * (p._om != null ? p._om : 0.03); s.product = 'NH₃'; s.product_ta = nh3;
      s.items.push({ slot: 'ammonia', size: nh3, capex: nh3 * p.capex / 1e6, om: nh3 * p.capex / 1e6 * (p._om != null ? p._om : 0.03) }); s.nh3Tank_t = nh3 / 365 * 30;
      s.notes.push('Ammonia: ' + nh3.toFixed(0) + ' t/a, synthesis ' + r.E.toFixed(2) + ' MWh/t (DM 15.2/15.3).'); return s; }, 'Converts the hydrogen stream to ammonia.');
  blk('methanol', 'Methanol synthesis', 11, '#d35400',
    [['ecap', 'CO₂ capture', 'MWh/t CO₂', 0.5], ['esyn', 'Synthesis', 'MWh/t', 0.6], ['capex', 'CAPEX', 'EUR per t/a', 900], ['co2price', 'CO₂ cost', 'EUR/t', 60]],
    (s, p) => { const r = R('CM-15.5', { mH2: s.H2_ta * 1000 / 8760, SEC: 52, ecap: p.ecap, esyn: p.esyn }); const m = r.mMeOH * 8.76; addDown(s, m * (1.373 * p.ecap + p.esyn) / 1000); s.capex += m * p.capex / 1e6; s.opex += m * 1.373 * p.co2price / 1e6 + m * p.capex / 1e6 * (p._om != null ? p._om : 0.03); s.product = 'CH₃OH'; s.product_ta = m;
      s.items.push({ slot: 'methanol', size: m, capex: m * p.capex / 1e6, om: m * p.capex / 1e6 * (p._om != null ? p._om : 0.03) });
      s.notes.push('Methanol: ' + m.toFixed(0) + ' t/a, CO₂ ' + (m * 1.373).toFixed(0) + ' t/a (CM 15.5).'); return s; }, 'Converts hydrogen + captured CO₂ to methanol.');
  blk('fuelcell', 'Fuel cell (power-to-power)', 11, '#9b59b6',
    [['V', 'Cell voltage', 'V', 0.7], ['ef', 'Fuel utilisation', '–', 0.98], ['kBoP', 'BoP share', '–', 0.12], ['capex', 'CAPEX', 'EUR/kW', 2000]],
    (s, p) => { const e = p.V * p.ef / 1.253 * (1 - p.kBoP); const Eout = s.H2_ta * C.LHV * e / 1000; const Pfc = s.mdot_kgh * C.LHV * e / 1000 * 2; s.capex += Pfc * p.capex / 1000; s.product = 'electricity'; s.product_ta = Eout * 1000;
      const fOM = p._om != null ? Pfc * p.capex / 1000 * p._om : 0; s.opex += fOM; s.items.push({ slot: 'fuelcell', size: Pfc * 1000, capex: Pfc * p.capex / 1000, om: fOM });
      s.notes.push('Fuel cell: net η_LHV ' + (100 * e).toFixed(1) + ' %, ' + Eout.toFixed(1) + ' GWh/a returned, round trip ' + (100 * Eout / Math.max(s.E_GWh, 1e-9)).toFixed(1) + ' % (CM 16.2, DM 17.3).'); return s; }, 'Re-electrification.');
  blk('hrs', 'Refuelling station 700 bar', 11, '#e67e22',
    [['fp', 'Peak-hour fraction', '–', 0.12], ['Tout', 'Dispensing temperature', '°C', -40], ['capex', 'Station CAPEX', 'MEUR per t/d', 3]],
    (s, p) => { const md = s.H2_ta * 1000 / 365; const r = R('DM-16.1', { m: md, fp: p.fp, top: 20, mg: 0.25, nb: 6, mf: 5, tb: 0.5, cp: 14.3, Tin: 25, Tout: p.Tout, COP: p._COP || 1.2 });
      const c2 = H2.compress(s.p_bar, 900, 40, { rmax: H2.rmaxForT(40, 120, H2.COMP_ETA.s), mdot_kgh: r.comp });
      addDown(s, s.H2_ta * (c2.SEC_kWhkg + r.Epc) / 1000); s.capex += md / 1000 * p.capex; s.product = 'H₂ @ 700 bar'; s.hrs = { Tout: p.Tout, casc_p: 900 }; s.p_bar = 700;
      const hOM = p._om != null ? md / 1000 * p.capex * p._om : 0; s.opex += hOM; s.items.push({ slot: 'hrs', size: md / 1000, capex: md / 1000 * p.capex, om: hOM });
      s.notes.push('HRS: ' + md.toFixed(0) + ' kg/d, peak ' + r.peak.toFixed(0) + ' kg/h, booster to 900 bar in ' + c2.N + ' stages ' + c2.SEC_kWhkg.toFixed(2) + ' kWh/kg + pre-cooling ' + r.Epc.toFixed(2) + ' kWh/kg (DM 16.1–16.3).'); return s; }, 'Refuelling station with 900 bar cascade and pre-cooling (SAE J2601 T40 fuelling).');
  blk('blending', 'Gas-grid blending', 11, '#95a5a6',
    [['x', 'H₂ volume fraction', '–', 0.1], ['HHVg', 'Natural-gas HHV', 'MJ/Nm³', 39.8], ['dg', 'Relative density', '–', 0.58]],
    (s, p) => { if (!(p.x > 0 && p.x < 1)) throw new Error('the hydrogen fraction must lie between 0 and 1'); const r = R('CM-16.5', { x: p.x, HHVg: p.HHVg, dg: p.dg }); const VH2 = s.H2_ta * 1000 / C.rhoN; const Vng = VH2 * (1 - p.x) / p.x; s.product = 'H₂–NG blend';
      s.notes.push('Blend ' + (100 * p.x) + ' vol-%: Wobbe ' + r.W.toFixed(1) + ' MJ/Nm³, H₂ energy share ' + (100 * r.share).toFixed(1) + ' %, gas flow needed ' + (Vng / 1e6).toFixed(0) + ' MNm³/a (CM 16.5).'); return s; }, 'Injection into the natural-gas grid.');
  blk('economics', 'Economics & carbon (LCOH, CI)', 12, '#2c3e50',
    [['WACC', 'WACC', '–', 0.08], ['life', 'Life', 'a', 25], ['f_ind', 'Indirect', '–', 0.12], ['f_cont', 'Contingency + owner', '–', 0.14], ['other', 'Other direct costs', 'MEUR', 20]],
    (s, p) => { if (!(p.WACC > -0.5 && p.WACC < 1) || !(p.life >= 1 && p.life <= 100)) throw new Error('WACC or life out of range'); const e = H2.chainEcon(s, p); Object.assign(s, { LCOH: e.LCOH, CAPEX_total: e.CAPEX, annual: e.annual, CI: e.CI, ciGrid: e.ciGrid, ciTr: e.ciTr, otherDirect: p.other, econ: e });
      if (e.LCOP != null) s.LCOP = e.LCOP; const capex = e.CAPEX, ann = e.annual;
      s.notes.push('Economics: CAPEX ' + capex.toFixed(1) + ' MEUR, annual ' + ann.toFixed(1) + ' MEUR/a' + (e.downCost > 0 ? ' (incl. ' + e.downCost.toFixed(2) + ' MEUR/a for ' + (s.E_down_GWh || 0).toFixed(1) + ' GWh of downstream electricity)' : '') + (isFinite(s.LCOH) ? ', LCOH ' + s.LCOH.toFixed(2) + ' EUR/kg' + (s.LCOP ? ', levelised product cost ' + s.LCOP.toFixed(0) + ' EUR/' + (s.product === 'electricity' ? 'MWh' : 't') : '') + '; GHG intensity (RFNBO method) ' + s.CI.toFixed(2) + ' kg CO₂e/kg' : '; no hydrogen reaches this block, so LCOH and GHG intensity are not defined') + ' (DM 20.1/20.2, CM 18.1).'); return s; },
    'Totals the chain: CAPEX build-up, LCOH and GHG intensity by the RFNBO method (without equipment emissions).');

  /* economics of a chain (DM 20.1/20.2) – used by the Economics block and, with its defaults, by the impact assessment */
  H2.ECON_DEFAULTS = { WACC: 0.08, life: 25, f_ind: 0.12, f_cont: 0.14, other: 20 };
  H2.chainEcon = function (s, p) {
    p = Object.assign({}, H2.ECON_DEFAULTS, p || {});
    const capex = (s.capex + p.other) * (1 + p.f_ind) * (1 + p.f_cont); const crf = H2.CRF(p.WACC, p.life);
    const downCost = (s.E_down_GWh || 0) * (s.elecPrice || 0) / 1000;                     // MEUR/a: GWh × EUR/MWh / 1000
    const ann = crf * (capex + (s.stackPV || 0)) + s.opex + downCost;
    const H = s.H2_ta > 1e-6 ? s.H2_ta : NaN;                                            // no hydrogen → no levelised cost or intensity
    const ciGrid = ((s.gridGWh || 0) * (s.gridCI || 0) + (s.E_down_GWh || 0) * (s.elecCI || 0)) / H;   // GWh·g/kWh = t CO₂ → t/t
    const ciTr = (s.CO2_t || 0) / H;                                                                     // t CO₂ / t H₂ = kg/kg
    return { CAPEX: capex, direct: s.capex + p.other, other: p.other, annual: ann, CRF: crf, LCOH: ann * 1000 / H, LCOP: s.product_ta ? ann * 1e6 / s.product_ta : null, CI: ciGrid + ciTr, ciGrid, ciTr, downCost, WACC: p.WACC, life: p.life, f_ind: p.f_ind, f_cont: p.f_cont };
  };
  H2.newStream = () => ({ H2_ta: 0, mdot_kgh: 0, p_bar: 1, T_C: 25, E_GWh: 0, E_down_GWh: 0, capex: 0, opex: 0, water_m3a: 0, CO2_t: 0, product: '', notes: [], items: [] });
  // copy of the stream that a block may change; the original is kept when the block fails
  const snap = s => Object.assign({}, s, { notes: s.notes.slice(), items: s.items.map(o => Object.assign({}, o)), comps: s.comps ? s.comps.slice() : undefined });
  H2.runFlowsheet = function (blocks) {
    let s = H2.newStream(); const trace = []; const selBySlot = {};
    blocks.forEach((b, i) => {
      if (b.comps) Object.keys(b.comps).forEach(k => { if (b.comps[k]) selBySlot[k] = b.comps[k]; });
      const def = own(B, b.type); if (!def) { s.notes.push('⚠ Unknown block type "' + String(b.type).slice(0, 24) + '": skipped'); s.invalid = true; return; }
      let p = {}; def.params.forEach(q => { const v = b.params && b.params[q[0]] !== undefined ? b.params[q[0]] : q[3]; p[q[0]] = (typeof q[3] === 'number' && v !== '' ? Number(v) : v); });
      if (b.comps && H2.blockParamsWithComps) p = H2.blockParamsWithComps(b.type, p, b.comps);
      if (b.type === 'water' && b.comps && b.comps.water) p._src = b.comps.water.p.src;
      const n0 = s.items.length;
      try { const s1 = def.run(snap(s), p); s = s1; } catch (e) { s.notes.push('⚠ ' + def.label + ': ' + e.message); s.invalid = true; }
      // attach the library component (or the default one) to the equipment of this block
      for (let k = n0; k < s.items.length; k++) { const it = s.items[k]; it.block = i; it.blockType = b.type;
        const sel = (b.comps && b.comps[it.slot]) || selBySlot[it.slot];
        it.comp = sel ? JSON.parse(JSON.stringify(sel)) : (H2.libDefault ? H2.libDefault(it.slot, { tech: s.ely ? s.ely.tech : p.tech, TDS: s.waterCfg ? s.waterCfg.TDS : p.TDS, track: s.supply ? s.supply.track : p.track, p: s.store ? s.store.pmax : s.p_bar, D: p.D, payload: p.payload, vmean: s.supply ? s.supply.v : p.v }) : null);
        if (it.comp) it.comp.selected = !!sel; }
      trace.push({ i, type: b.type, label: def.label, H2_ta: s.H2_ta, p_bar: s.p_bar, E_GWh: s.E_GWh, capex: s.capex, note: s.notes[s.notes.length - 1] });
    });
    return { stream: s, trace };
  };
  H2.FLOWSHEETS = {
    'Case B – islanded ammonia export': [
      { type: 'supply', params: { pv: 180, wind: 60, bat: 30, batE: 60, grid: 0, GHI: 2200, lat: 29, v: 8.6, track: 1.25, seed: 7 } },
      { type: 'water', params: { TDS: 41, Y1: 0.42, Y2: 0.9, wDI: 10.5, price: 0.3, capex: 3500 } },
      { type: 'electrolyser', params: { tech: 'AEL', P: 100, minLoad: 0.2, capex: 1000, aux: 6 } },
      { type: 'compressor', params: { p2: 100 } }, { type: 'storage', params: { mode: 'hourly', pmin: 30 } },
      { type: 'ammonia', params: {} }, { type: 'economics', params: { WACC: 0.08, other: 60 } }],
    'Case A – grid PPA, pipeline customer': [
      { type: 'supply', params: { pv: 30, wind: 15, bat: 0, batE: 0, grid: 12, gridCI: 300, gridPrice: 80, gridMode: 'fill', GHI: 1150, lat: 50, v: 7.3, track: 1.12, seed: 3 } },
      { type: 'water', params: { TDS: 0.35, Y1: 0.8, Y2: 1, wDI: 10, price: 2.0, capex: 1500 } },
      { type: 'electrolyser', params: { tech: 'PEM', P: 10, minLoad: 0.1, capex: 1500, aux: 0.7 } },
      { type: 'compressor', params: { p2: 250 } }, { type: 'storage', params: { mode: 'days', days: 1, pmin: 35 } },
      { type: 'pipeline', params: { L: 2, D: 0.1, p2: 25, capex: 0.65 } }, { type: 'economics', params: { WACC: 0.07, other: 8 } }],
    'Solar-only PEM to refuelling station': [
      { type: 'supply', params: { pv: 6, wind: 0, bat: 1, batE: 2, grid: 0, GHI: 2100, lat: 31, v: 6, track: 1.2, seed: 11 } },
      { type: 'electrolyser', params: { tech: 'PEM', P: 3, minLoad: 0.05, capex: 1800, aux: 0.15 } },
      { type: 'compressor', params: { p2: 500 } }, { type: 'storage', params: { mode: 'hourly', flex: 24, turndown: 0.9, pmin: 50 } },
      { type: 'hrs', params: {} }, { type: 'economics', params: { WACC: 0.08, other: 2 } }]
  };

  /* ------------------------------------------------------------------
     4. Predefined experiments
     each returns {charts:[{title,xlabel,ylabel,x:[],series:[{name,y:[]}]}], table:{cols,rows}, text}
     ------------------------------------------------------------------ */
  const E = H2.EXPERIMENTS = [];
  function exp(id, title, level, refs, desc, params, run) { E.push({ id, title, level, refs, desc, params, run }); }
  const rng = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);

  exp('pol', 'Polarisation curves of the four technologies', 2, 'CM 3.5, 3.6, 4.4–4.10, 7.5',
    'Cell voltage and loss breakdown versus current density for PEM, alkaline, AEM and SOEC presets. Shows why SOEC reaches ~36 kWh/kg and why PEM runs at 3–5× the current density of alkaline cells.',
    [['T', 'Temperature offset', 'K', 0]],
    p => { const techs = ['PEM', 'AEL', 'AEM', 'SOEC']; const x = rng(0.02, 3, 60); const series = techs.map(t => ({ name: t, y: x.map(j => { const tp = Object.assign({}, H2.TECH[t], { T_C: H2.TECH[t].T_C + p.T }); return j < tp.jlim * 0.98 ? H2.cell(tp, j).Ecell : null; }) }));
      const tp = H2.TECH.PEM; const br = ['Erev', 'eta_a', 'eta_c', 'eta_ohm', 'eta_conc'].map(k => ({ name: k, y: x.map(j => H2.cell(tp, Math.min(j, tp.jlim * 0.98))[k]) }));
      const rows = techs.map(t => { const c = H2.cell(H2.TECH[t], H2.TECH[t].jnom); return [t, H2.TECH[t].T_C, H2.TECH[t].jnom, c.Ecell.toFixed(3), c.SEC_stack.toFixed(1), (100 * c.eff_HHV).toFixed(1)]; });
      return { charts: [{ title: 'Polarisation curves', xlabel: 'j (A/cm²)', ylabel: 'E_cell (V)', x, series }, { title: 'PEM loss breakdown (stacked components)', xlabel: 'j (A/cm²)', ylabel: 'V', x, series: br, stacked: true }],
        table: { cols: ['Tech', 'T (°C)', 'j_nom', 'E_cell (V)', 'SEC stack', 'η_HHV %'], rows } }; });
  exp('temp', 'Temperature and pressure effects on the PEM cell', 1, 'CM 3.5, 3.6, 4.5, 4.8',
    'Sweeps stack temperature (20–90 °C) and cathode pressure (1–80 bar); the reversible voltage falls with T, the Nernst term rises with p, and membrane conductivity improves with T.',
    [['j', 'Current density', 'A/cm²', 2]],
    p => { const Ts = rng(20, 90, 35); const tp = H2.TECH.PEM; const volt = Ts.map(T => H2.cell(Object.assign({}, tp, { T_C: T, ASR: 0.183 / (H2.nafionSigma(22, K(T)) * 10000 / 100) * 1 + 0.03 }), p.j).Ecell);
      const erev = Ts.map(T => H2.ErevT(K(T))); const ps = rng(1, 80, 40); const pv = ps.map(pp => H2.cell(Object.assign({}, tp, { pH2: pp }), p.j).Ecell);
      const mech = ps.map(pp => H2.compress(1, Math.max(pp, 1.01), 35, { rmax: 3, mdot_kgh: 1 }).SEC_kWhkg / C.kSEC + H2.cell(Object.assign({}, tp, { pH2: 1 }), p.j).Ecell);
      return { charts: [{ title: 'Cell voltage vs temperature (Nafion ASR from CM 4.8)', xlabel: 'T (°C)', ylabel: 'V', x: Ts, series: [{ name: 'E_cell', y: volt }, { name: 'E_rev (CM 3.5)', y: erev }] },
        { title: 'Pressurised stack vs atmospheric stack + mechanical compressor', xlabel: 'H₂ pressure (bar)', ylabel: 'Equivalent cell voltage (V)', x: ps, series: [{ name: 'Electrochemical (Nernst)', y: pv }, { name: 'Atmospheric + compressor', y: mech }] }] }; });
  exp('partload', 'Part-load efficiency, Faradaic losses and gas purity', 4, 'CM 6.4, 7.6, 7.7, 7.8, DM 10.2',
    'System SEC and hydrogen-in-oxygen versus load. At low load cross-over dominates: η_F falls and H₂-in-O₂ crosses the 2 % trip – this sets the minimum load.',
    [['tech', 'Technology', '', 'PEM']],
    p => { const tp = H2.TECH[p.tech] || H2.TECH.PEM; const sys = H2.system(tp, 1000, {}); const L = rng(0.03, 1, 50); const r = L.map(l => sys.atLoad(l));
      return { charts: [{ title: 'System and stack SEC vs load', xlabel: 'Load (–)', ylabel: 'kWh/kg', x: L, series: [{ name: 'SEC system', y: r.map(o => o.SEC_sys) }, { name: 'SEC stack', y: r.map(o => o.SEC_stack) }] },
        { title: 'H₂ in O₂ vs load (trip 2 %)', xlabel: 'Load (–)', ylabel: '%', x: L, series: [{ name: 'H₂ in O₂', y: r.map(o => o.xH2inO2 * 100) }, { name: '2 % trip', y: L.map(() => 2) }] }] }; });
  exp('degr', 'Degradation over the stack life', 3, 'CM 6.6, DM 9.1',
    'Cell voltage, SEC and stack heat from beginning to end of life at a constant degradation rate.',
    [['rd', 'Degradation rate', 'µV/h', 5], ['h', 'Operating hours per year', 'h', 6000]],
    p => { const tp = H2.TECH.PEM; const E0 = H2.cell(tp, tp.jnom).Ecell; const t = rng(0, 80000, 40); const E1 = t.map(x => E0 + p.rd * 1e-6 * x);
      return { charts: [{ title: 'SEC and heat vs operating hours', xlabel: 'Operating hours', ylabel: 'kWh/kg', x: t, series: [{ name: 'SEC stack', y: E1.map(e => C.kSEC * e) }, { name: 'Heat per kg', y: E1.map(e => C.kSEC * (e - C.Etn25)) }] }],
        text: 'End of life at +10 %: ' + (0.1 * E0 / (p.rd * 1e-6)).toFixed(0) + ' h = ' + (0.1 * E0 / (p.rd * 1e-6) / p.h).toFixed(1) + ' years.' }; });
  exp('hybrid', 'Hybrid PV–wind sizing sweep (DM Table 4.1 replica)', 5, 'DM Fig. 4.2, 4.3; CM 14.5; DM 20.2',
    'Hourly simulation of the Case B plant for a grid of PV and wind capacities. Reports capacity factor, curtailment and LCOH – reproduce the selection of 180 MWp + 60 MW.',
    [['pvMin', 'PV from', 'MWp', 100], ['pvMax', 'PV to', 'MWp', 260], ['steps', 'Steps', '–', 5]],
    p => { const pvs = rng(p.pvMin, p.pvMax, p.steps); const winds = [0, 40, 60, 80, 100]; const cf = [], cu = [], lc = []; const rows = [];
      winds.forEach(wd => { const a = [], b = [], c = []; pvs.forEach(pvp => { const cfg = H2.defaultHourly(); cfg.pv.P_MWp = pvp; cfg.wind.P_MW = wd; const r = H2.hourly(cfg); a.push(r.kpi.CF); b.push(100 * r.kpi.curt_share); c.push(r.kpi.LCOH); rows.push([pvp, wd, r.kpi.E_RE_GWh.toFixed(0), r.kpi.CF.toFixed(3), r.kpi.FLH.toFixed(0), (100 * r.kpi.curt_share).toFixed(1), r.kpi.H2_t.toFixed(0), r.kpi.starts, r.kpi.LCOH.toFixed(2)]); });
        cf.push({ name: 'wind ' + wd + ' MW', y: a }); cu.push({ name: 'wind ' + wd + ' MW', y: b }); lc.push({ name: 'wind ' + wd + ' MW', y: c }); });
      return { charts: [{ title: 'Electrolyser capacity factor', xlabel: 'PV (MWp)', ylabel: 'CF', x: pvs, series: cf }, { title: 'Curtailed share of RE', xlabel: 'PV (MWp)', ylabel: '%', x: pvs, series: cu }, { title: 'LCOH', xlabel: 'PV (MWp)', ylabel: 'EUR/kg', x: pvs, series: lc }],
        table: { cols: ['PV MWp', 'Wind MW', 'RE GWh', 'CF', 'FLH', 'Curt. %', 'H₂ t/a', 'Starts', 'LCOH'], rows } }; });
  exp('battery', 'Battery sizing for an islanded plant', 5, 'DM 4.4, Fig. 4.2',
    'Sweeps the battery energy (2-h units) for Case B and shows the effect on capacity factor, starts, hours at minimum load and LCOH.',
    [['maxMWh', 'Largest battery', 'MWh', 300]],
    p => { const Es = rng(0, p.maxMWh, 10); const r = Es.map(e => { const cfg = H2.defaultHourly(); cfg.battery.E_MWh = e; cfg.battery.P_MW = e / 2; return H2.hourly(cfg).kpi; });
      return { charts: [{ title: 'Capacity factor and LCOH', xlabel: 'Battery (MWh)', ylabel: 'CF / LCOH÷10', x: Es, series: [{ name: 'CF', y: r.map(k => k.CF) }, { name: 'LCOH/10 (EUR/kg)', y: r.map(k => k.LCOH / 10) }] },
        { title: 'Starts per year', xlabel: 'Battery (MWh)', ylabel: 'starts', x: Es, series: [{ name: 'starts', y: r.map(k => k.starts) }, { name: 'hours at min load /10', y: r.map(k => k.hours_min / 10) }] }] }; });
  exp('tornado', 'LCOH sensitivity (tornado)', 12, 'CM 17.1, 17.3',
    'Each input of the simple LCOH equation is varied ±20 % (±30 % for electricity price) around the reference plant of CM Example 17.1.',
    [['pm', 'Variation', '–', 0.2]],
    p => { const base = { Cinv: 1500, r: 0.07, n: 25, fOM: 0.03, CF: 0.5, SEC: 52, sf: 0.35, sl: 80000, pel: 50, cw: 0.05 }; const L0 = R('CM-17.3', base).LCOH;
      const keys = [['pel', 'Electricity price'], ['CF', 'Capacity factor'], ['Cinv', 'CAPEX'], ['SEC', 'SEC'], ['r', 'WACC'], ['fOM', 'Fixed O&M'], ['sl', 'Stack life'], ['n', 'Lifetime']];
      const rows = keys.map(([k, lab]) => { const lo = Object.assign({}, base), hi = Object.assign({}, base); lo[k] = base[k] * (1 - p.pm); hi[k] = base[k] * (1 + p.pm); return [lab, R('CM-17.3', lo).LCOH, R('CM-17.3', hi).LCOH]; });
      rows.sort((a, b) => Math.abs(b[2] - b[1]) - Math.abs(a[2] - a[1]));
      return { charts: [{ title: 'Tornado around LCOH = ' + L0.toFixed(2) + ' EUR/kg', type: 'tornado', base: L0, rows }], table: { cols: ['Parameter', '−' + p.pm * 100 + ' %', '+' + p.pm * 100 + ' %'], rows: rows.map(r => [r[0], r[1].toFixed(2), r[2].toFixed(2)]) } }; });
  exp('lcohmap', 'LCOH map: capacity factor × electricity price', 12, 'CM 17.3',
    'Heat map of the simple LCOH equation; the iso-lines show why cheap but intermittent electricity must be traded against capacity factor.',
    [['Cinv', 'CAPEX', 'EUR/kW', 1500]],
    p => { const cfs = rng(0.15, 0.95, 16), pels = rng(10, 100, 18); const z = pels.map(pe => cfs.map(cf => R('CM-17.3', { Cinv: p.Cinv, CF: cf, pel: pe }).LCOH));
      return { charts: [{ title: 'LCOH (EUR/kg)', type: 'heatmap', x: cfs, y: pels, z, xlabel: 'Capacity factor', ylabel: 'Electricity price (EUR/MWh)' }] }; });
  exp('comp', 'Compression energy vs pressure and stages', 8, 'CM 10.1, 10.2, 10.4, 10.6',
    'Isothermal, single-stage isentropic, multistage intercooled and electrochemical compression from 30 bar to the final pressure.',
    [['p1', 'Suction pressure', 'bar', 30]],
    p => { const ps = rng(p.p1 * 1.5, 1000, 40); const iso = ps.map(x => R('CM-10.1', { p1: p.p1, p2: x, T1: 25, Zm: 1 }).w); const s1 = ps.map(x => R('CM-10.2', { p1: p.p1, p2: x, T1: 25, Zm: 1 }).w);
      const ms = ps.map(x => H2.compress(p.p1, x, 25, { rmax: 2.3, eta_s: 1, eta_mech: 1, eta_motor: 1 }).w_ideal_kWhkg); const el = ps.map(x => H2.compress(p.p1, x, 25, { rmax: 2.3 }).SEC_kWhkg);
      const ec = ps.map(x => R('CM-10.6', { T: 60, p1: p.p1, p2: x, j: 1, ASR: 0.2 }).SEC);
      return { charts: [{ title: 'Specific work', xlabel: 'Final pressure (bar)', ylabel: 'kWh/kg', x: ps, series: [{ name: 'Isothermal', y: iso }, { name: 'Isentropic 1 stage', y: s1 }, { name: 'Multistage ideal (r≤2.3)', y: ms }, { name: 'Multistage electrical', y: el }, { name: 'Electrochemical', y: ec }] }] }; });
  exp('density', 'Real vs ideal gas: storage density', 9, 'CM 2.1, 2.4, 2.5, 9.1',
    'Density versus pressure at 15 °C for ideal and Abel–Noble gas. Doubling 350 → 700 bar adds only ~70 % mass.',
    [['T', 'Temperature', '°C', 15]],
    p => { const ps = rng(1, 1000, 50); return { charts: [{ title: 'Hydrogen density', xlabel: 'p (bar)', ylabel: 'kg/m³', x: ps, series: [{ name: 'Ideal gas', y: ps.map(x => H2.rhoIdeal(x, K(p.T))) }, { name: 'Real gas (Abel–Noble)', y: ps.map(x => H2.rho(x, K(p.T))) }, { name: 'Liquid (20 K)', y: ps.map(() => C.rhoL) }] },
      { title: 'Compressibility factor Z', xlabel: 'p (bar)', ylabel: 'Z', x: ps, series: [{ name: 'Z', y: ps.map(x => H2.Z(x, K(p.T))) }] }] }; });
  exp('p90', 'Weather-year Monte Carlo: P50 / P90 production', 5, 'DM 3.1, 4.3',
    'Runs the hourly model for many synthetic weather years (different random seeds) and derives the exceedance values of hydrogen production.',
    [['n', 'Number of years', '–', 20]],
    p => { const vals = []; for (let i = 1; i <= p.n; i++) { const cfg = H2.defaultHourly(); cfg.weather.seed = 100 + i; vals.push(H2.hourly(cfg).kpi.H2_t); }
      const s = vals.slice().sort((a, b) => a - b); const mean = vals.reduce((a, b) => a + b, 0) / vals.length; const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (vals.length - 1));
      return { charts: [{ title: 'Annual hydrogen by weather year', type: 'bar', x: vals.map((_, i) => i + 1), series: [{ name: 't/a', y: vals }], xlabel: 'Year', ylabel: 't/a' }],
        text: 'P50 = ' + mean.toFixed(0) + ' t/a, σ = ' + (100 * sd / mean).toFixed(1) + ' %, P90 = ' + (mean - 1.282 * sd).toFixed(0) + ' t/a (DM 3.1); lowest year ' + s[0].toFixed(0) + ' t.' }; });
  exp('transport', 'Transport: pipeline vs tube trailers', 10, 'CM 13.1, 13.3, 20.1',
    'Energy and CO₂ of trailer delivery versus distance, and pipeline capacity versus diameter.',
    [['m', 'Demand', 'kg/d', 5000]],
    p => { const d = rng(20, 500, 24); const t1 = d.map(x => R('CM-13.3', { m: p.m, mu: 330, d: x }).frac * 100); const t2 = d.map(x => R('CM-13.3', { m: p.m, mu: 1000, d: x }).frac * 100);
      const D = rng(0.1, 1.0, 18); const cap = D.map(x => R('CM-13.1', { L: 100, D: x, f: 0.013, Zm: 1.04, T: 15, p1: 70, p2: 50 }).P);
      return { charts: [{ title: 'Diesel energy as % of delivered LHV', xlabel: 'One-way distance (km)', ylabel: '%', x: d, series: [{ name: '200 bar steel (330 kg)', y: t1 }, { name: '500 bar composite (1000 kg)', y: t2 }] },
        { title: 'Pipeline capacity (100 km, 70→50 bar)', xlabel: 'Diameter (m)', ylabel: 'MW (LHV)', x: D, series: [{ name: 'capacity', y: cap }] }] }; });
  exp('carbon', 'GHG intensity vs grid share (RFNBO / Taxonomy / 45V)', 13, 'CM 18.1, 18.3; Del. Reg. (EU) 2023/1185',
    'GHG intensity of hydrogen as the grid share of electricity rises, by the RFNBO method (renewable electricity at zero, no equipment emissions) and as a life-cycle value with the embodied emissions of the equipment. Thresholds: EU RFNBO 3.38, EU Taxonomy 3.0 (life cycle), US 45V top tier 0.45 kg CO₂e/kg.',
    [['gridCI', 'Grid CI', 'g/kWh', 300], ['SEC', 'SEC', 'kWh/kg', 55], ['emb', 'Embodied emissions of the equipment', 'kg CO₂e/kg', 1.5]],
    p => { const x = rng(0, 0.5, 25); const op = x.map(s => R('CM-18.1', { CIel: s * p.gridCI, SEC: p.SEC, emb: 0 }).CI);
      return { charts: [{ title: 'GHG intensity of hydrogen', xlabel: 'Grid share (–)', ylabel: 'kg CO₂e/kg', x, series: [{ name: 'RFNBO method (18.1)', y: op }, { name: 'life cycle incl. equipment', y: op.map(v => v + p.emb) }, { name: 'with 2 % leakage (18.3)', y: op.map(v => R('CM-18.3', { l: 0.02, CI: v }).tot) }, { name: 'RFNBO 3.38', y: x.map(() => 3.38) }, { name: 'Taxonomy 3.0', y: x.map(() => 3.0) }, { name: '45V 0.45', y: x.map(() => 0.45) }] }],
        text: 'Largest grid share for the RFNBO threshold: ' + (100 * 3.38 * 1000 / p.SEC / p.gridCI).toFixed(1) + ' % at ' + p.gridCI + ' g/kWh (hourly correlation from 2030).' }; });
  exp('safety', 'Consequences of leaks: hole size and pressure', 14, 'CM 19.1, 19.5, 19.6, 19.8',
    'Release rate, LFL distance, flame length and radiation distance for leaks from 30–900 bar systems.',
    [['p', 'Pressure', 'bar', 350]],
    p => { const d = rng(0.5, 10, 20); const r = d.map(x => { const m = R('CM-19.1', { d: x, p: p.p, T: 20, Cd: 0.85 }); const j = R('CM-19.5', { d: x, rho0: m.rho0, m: m.m / 1000 }); const q = R('CM-19.6', { m: m.m / 1000, q: 4.7 }); return [m.m, j.xLFL, j.Lf, q.r]; });
      return { charts: [{ title: 'Hazard distances at ' + p.p + ' bar', xlabel: 'Hole diameter (mm)', ylabel: 'm', x: d, series: [{ name: 'Distance to LFL', y: r.map(a => a[1]) }, { name: 'Flame length', y: r.map(a => a[2]) }, { name: 'Distance to 4.7 kW/m²', y: r.map(a => a[3]) }] },
        { title: 'Release rate', xlabel: 'Hole diameter (mm)', ylabel: 'g/s', x: d, series: [{ name: 'ṁ', y: r.map(a => a[0]) }] }] }; });
  exp('learning', 'Cost outlook with learning curves', 12, 'CM 17.8, 17.3',
    'Electrolyser CAPEX along a learning curve and the resulting LCOH at two capacity factors.',
    [['LR', 'Learning rate', '–', 0.18]],
    p => { const Q = rng(10, 500, 30); const cap = Q.map(q => R('CM-17.8', { C0: 1500, Q0: 10, Q: q, LR: p.LR }).C);
      return { charts: [{ title: 'CAPEX vs installed capacity', xlabel: 'Global capacity (GW)', ylabel: 'EUR/kW', x: Q, series: [{ name: 'CAPEX', y: cap }] },
        { title: 'LCOH (50 EUR/MWh)', xlabel: 'Global capacity (GW)', ylabel: 'EUR/kg', x: Q, series: [{ name: 'CF 0.3', y: cap.map(c => R('CM-17.3', { Cinv: c, CF: 0.3 }).LCOH) }, { name: 'CF 0.6', y: cap.map(c => R('CM-17.3', { Cinv: c, CF: 0.6 }).LCOH) }, { name: 'CF 0.9', y: cap.map(c => R('CM-17.3', { Cinv: c, CF: 0.9 }).LCOH) }] }] }; });
  exp('ro', 'Desalination: RO energy vs recovery', 6, 'DM 8.1, 8.2, 8.4, 8.5',
    'High-pressure energy of seawater RO with and without an energy-recovery device versus recovery; feed pressure follows the concentrate osmotic pressure.',
    [['cf', 'Feed TDS', 'g/L', 41]],
    p => { const Y = rng(0.2, 0.6, 24); const r = Y.map(y => { const o = R('DM-8.1', { cf: p.cf, Y: y, Rs: 0.997 }); const pf = o.pic * 1.1 + 5; return R('DM-8.4', { pf, ep: 0.8, Y: y, eERD: 0.96, pb: pf - 1.5, dpl: 1.5 }); });
      return { charts: [{ title: 'SWRO high-pressure energy', xlabel: 'Recovery (–)', ylabel: 'kWh/m³', x: Y, series: [{ name: 'no ERD', y: r.map(a => a.s0) }, { name: 'with ERD', y: r.map(a => a.s1) }] }] }; });
  exp('storage', 'Storage need vs offtake flexibility', 9, 'CM 14.7, DM 13.1, 13.2',
    'Usable buffer mass and geometric volume from the hourly inventory of Case B for flat offtake and increasing battery size.',
    [['p', 'Storage pressure', 'bar', 100]],
    p => { const cfg = H2.defaultHourly(); cfg.storage.p_max = p.p; const r = H2.hourly(cfg); const x = rng(0, 8759, 8759).map(Math.round);
      const d = []; const inv = []; for (let h = 0; h < 8760; h += 24) { d.push(h / 24); inv.push(r.series.inv[h] / 1000); }
      return { charts: [{ title: 'Inventory over the year (t)', xlabel: 'Day', ylabel: 't', x: d, series: [{ name: 'I(t) – min I', y: inv }] }],
        text: 'Usable buffer ' + r.kpi.buffer_t.toFixed(0) + ' t → ' + r.kpi.buffer_V_m3.toFixed(0) + ' m³ at ' + p.p + '/30 bar. Seasonal storage in pressure vessels is uneconomic – the Design Manual shifts it to the product (ammonia tanks) or to caverns (CM 12.6).' }; });
})(typeof window !== 'undefined' ? window : globalThis);

;
/* Hasim – Green Hydrogen Engineering Suite. © 2026 Prof. Hani Muhsen. All rights reserved. */
/* =====================================================================
   Hasim – engine-system.js
   System solver: turns a design basis into a complete engineering
   model – equipment list with tags, design-point mass & energy balance
   with numbered streams, electrical one-line data, annual energy and
   mass balances (Sankey), water-treatment and compression trains, cell
   and stack data, a plot plan with safety distances, design checks and
   a screening against codes, standards and regulations.
   Author and owner: Prof. Hani Muhsen.
   ===================================================================== */
(function (root) {
  'use strict';
  const H2 = root.H2, C = H2.C, K = H2.K, own = H2.own;
  const R = (id, x) => H2.run(id, x);

  /* ---------- extended design bases (site, supply, chemistry) ---------- */
  const EXT = {
    A: { batMW: 0, batMWh: 0, gridMW: 12, gridMode: 'target', gridTarget: 0.45, T_mean: 10, cloudiness: 0.45, seed: 3, flex_h: 0, turndown: 0.3, storePmin: 35, storeSizing: 'days',
      mvKV: 20, Ssc: 250, Ca: 80, SO4: 60, Alk: 200, pH: 7.6, Twater: 15, auxFrac: 0.07, pvCapex: 0, windCapex: 0, batCapex: 350, storeCapex: 600, waterPrice: 2.0, minLoad: 0.1, siteName: 'Industrial park, 50° N', region: 'oecd', stress: 'lowmed' },
    B: { batMW: 30, batMWh: 60, gridMW: 0, gridMode: 'fill', T_mean: 26, cloudiness: 0.12, seed: 7, flex_h: 168, turndown: 0.3, storePmin: 30, storeSizing: 'hourly',
      mvKV: 33, Ssc: 0, auxBackupMW: 5, Ca: 420, SO4: 2700, Alk: 120, pH: 8.1, Twater: 28, auxFrac: 0.06, pvCapex: 550, windCapex: 1300, batCapex: 350, storeCapex: 570, waterPrice: 0.1, minLoad: 0.2, siteName: 'Arid coast, 29° N', region: 'me', stress: 'extreme' },
    C: { batMW: 0, batMWh: 0, gridMW: 1.5, gridMode: 'target', gridTarget: 0.8, T_mean: 20, cloudiness: 0.2, seed: 5, flex_h: 24, turndown: 0.8, storePmin: 50, storeSizing: 'days',
      mvKV: 11, Ssc: 100, Ca: 90, SO4: 80, Alk: 180, pH: 7.5, Twater: 20, auxFrac: 0.08, pvCapex: 0, windCapex: 0, batCapex: 400, storeCapex: 900, waterPrice: 1.8, minLoad: 0.1, siteName: 'Urban logistics hub, 32° N', region: 'me', stress: 'high' }
  };
  // fields added by the expert review (defaults for every project; older project files get them on opening)
  H2.BASIS_DEFAULTS = { surplus: 'curtail', exportPrice: 30, Tdis: 120, soecHeat: 'electric', heatPrice: 25, owner: '', creator: '', approver: '', pvYield: 1600, windFLH: 3000, storeFrac: 1, gridTarget: 0.6, windK: 2,
    // Hasim 3.0 site data: hub height and shear exponent (Eq. 4.6) for measured wind below the hub, price-following grid mode,
    // the low-price rule of (EU) 2023/1184 Art. 4(3) with the ETS allowance price, and the pricing of sold surplus
    hubHeight: 100, windAlpha: 0.14, gridPriceCap: 50, lowPriceRule: 'on', etsPrice: 0, exportPricing: 'fixed',
    // Hasim 3.0 policy pack (engine-policy.js): grants, production premiums, contracts for difference, carbon pricing in the ROI
    policyPack: 'none', grantFrac: 0, grantMEUR: 0, premium: 0, premiumYears: 10, premiumDecline: 0, premiumTier: 'off', fxUSD: 0.92, cfdStrike: 0, co2Price: 0, co2Credit: 'off', greyPrice: 2, greyCI: 10 };
  Object.keys(EXT).forEach(k => { H2.CASES[k] = Object.assign({}, EXT[k], H2.CASES[k]); });
  H2.CASE_DEFAULTS = EXT.B;
  H2.completeBasis = function (b) { return Object.assign({}, EXT.B, H2.BASIS_DEFAULTS, H2.ASSESS_DEFAULTS || {}, { minLoad: (own(H2.TECH, b && b.tech) || H2.TECH.AEL).minLoad }, b); };

  /* ---------- engine-side limits of the design basis (also for bases from scripts and old files) ----------
     [min, max, integer?]; values outside are clamped and reported, inconsistent pairs are corrected */
  H2.BASIS_LIMITS = { demand: [1, 1e7], availability: [0.5, 1], modules: [1, 200, 1], moduleMW: [0.1, 50], minLoad: [0, 0.9], FLH: [500, 8760], capexEly: [100, 10000], stackFrac: [0, 0.8],
    pvMWp: [0, 1e5], windMW: [0, 1e5], batMW: [0, 1e4], batMWh: [0, 1e5], ppaShare: [0, 1], pel: [0, 1000], curtail: [0, 0.9], pvCapex: [0, 5000], windCapex: [0, 6000], batCapex: [0, 3000],
    pvYield: [100, 3500], windFLH: [0, 8760], lat: [-66, 66], GHI: [500, 2800], vmean: [2, 14], windK: [1.2, 4], T_mean: [-20, 40], cloudiness: [0, 1], seed: [1, 9999, 1], Tamb: [-10, 55],
    gridMW: [0, 1e4], gridTarget: [0, 1], gridCI: [0, 1200], mvKV: [6, 132], Ssc: [0, 1e5], auxBackupMW: [0, 1e3], auxFrac: [0, 0.3],
    TDS: [0.01, 60], Y1: [0.2, 0.95], Y2: [0.5, 1], wDI: [9, 20], Ca: [0, 2000], SO4: [0, 6000], Alk: [0, 2000], pH: [5, 10], Twater: [1, 40], waterPrice: [0, 20],
    storeP: [10, 900], storePmin: [1, 500], storeDays: [0.05, 30], storeFrac: [0, 1], flex_h: [0, 720], turndown: [0, 1], storeCapex: [0, 5000], pipeKm: [0, 2000], pipeP: [1, 200], trailer_kgd: [0, 1e5],
    WACC: [0, 0.3], life: [5, 50, 1], otherCapexFrac: [0, 5], fixedOpexFrac: [0, 0.2], exportPrice: [-100, 500], Tdis: [100, 150], heatPrice: [0, 500],
    hubHeight: [10, 250], windAlpha: [0, 0.6], gridPriceCap: [-100, 1000], etsPrice: [0, 500],
    grantFrac: [0, 0.9], grantMEUR: [0, 1e4], premium: [-20, 20], premiumYears: [1, 30, 1], premiumDecline: [0, 5], fxUSD: [0.3, 3], cfdStrike: [0, 50], co2Price: [0, 1000], greyPrice: [0, 20], greyCI: [0, 30] };
  const OPTIONS = { tech: ['PEM', 'AEL', 'AEM', 'SOEC'], supply: ['grid-ppa', 'islanded'], gridMode: ['fill', 'full', 'target', 'price'], product: ['H2', 'NH3'], deliver: ['pipeline', 'ammonia', 'hrs', 'none'],
    storeSizing: ['days', 'hourly'], surplus: ['curtail', 'export'], soecHeat: ['electric', 'external'], lowPriceRule: ['on', 'off'], exportPricing: ['fixed', 'spot'],
    policyPack: ['none', 'eu-h2bank', 'us-45v', 'us-48', 'in-sight', 'cfd', 'carbon', 'custom'], premiumTier: ['off', '45V'], co2Credit: ['off', 'avoided'] };
  H2.BASIS_OPTIONS = OPTIONS;
  H2.normalizeBasis = function (bIn) {
    const b = H2.completeBasis(bIn), notes = [], d = H2.completeBasis(H2.CASES.B);
    if (b.site != null) {   // measured site data (Hasim 3.0): validated once per object, dropped when unusable
      const cs = H2.cleanSite ? H2.cleanSite(b.site) : { site: null, notes: ['site data needs engine-site.js'] };
      cs.notes.forEach(x => notes.push('site data: ' + x)); if (cs.site) b.site = cs.site; else delete b.site;
    }
    Object.keys(OPTIONS).forEach(k => { if (!OPTIONS[k].includes(b[k])) { notes.push(k + ' "' + String(b[k]).slice(0, 20) + '" is not an option – ' + d[k] + ' used'); b[k] = d[k]; } });
    Object.keys(H2.BASIS_LIMITS).forEach(k => {
      const [mn, mx, int] = H2.BASIS_LIMITS[k]; let v = Number(b[k]);
      if (!isFinite(v)) { notes.push(k + ' is not a number – ' + d[k] + ' used'); v = Number(d[k]); }
      let c = Math.min(mx, Math.max(mn, v)); if (int) c = Math.round(c);
      if (c !== v) notes.push(k + ' = ' + v + ' is outside ' + mn + '…' + mx + ' – ' + c + ' used');
      b[k] = c;
    });
    if (!(b.storePmin < b.storeP)) { const v = Math.max(1, Math.round(b.storeP * 0.3 * 10) / 10); notes.push('minimum storage pressure ' + b.storePmin + ' bar is not below the storage pressure ' + b.storeP + ' bar – ' + v + ' bar used'); b.storePmin = v; }
    return { b, notes };
  };

  /* ---------- hourly configuration derived from a design basis ---------- */
  H2.hourlyFromBasis = function (b, design) {
    b = H2.completeBasis(b);
    const ov = H2.compModel ? H2.compModel(b) : {}, cm = b.comp || {};
    const c = H2.defaultHourly(); const tp = Object.assign({}, own(H2.TECH, b.tech) || H2.TECH.AEL, ov.tp || {}); const P = b.modules * b.moduleMW;
    const isl = b.supply === 'islanded';
    c.name = b.name;
    Object.assign(c.weather, { lat: b.lat, GHI_annual: b.GHI, v_mean: b.vmean, k: b.windK || 2, T_mean: b.T_mean, seed: b.seed, cloudiness: b.cloudiness });
    // measured site data (Hasim 3.0, engine-site.js): the measured year replaces the synthetic one, its wind is raised from the
    // measuring height to the hub by the power law (Eq. 4.6); hourly prices and carbon intensities replace the flat values
    const sw = H2.siteWeather ? H2.siteWeather(b) : null, sp = H2.siteSeries ? H2.siteSeries(b, 'price') : null, sc = H2.siteSeries ? H2.siteSeries(b, 'ci') : null;
    const hub = b.hubHeight > 0 ? b.hubHeight : 100;
    if (sw) c.weather = { data: sw, lat: b.lat };
    Object.assign(c.pv, { P_MWp: b.pvMWp, tracking: isl ? 1.25 : 1.12, capex_EURkWp: isl ? b.pvCapex : 0, om_frac: 0 });
    Object.assign(c.wind, { P_MW: b.windMW, capex_EURkW: isl ? b.windCapex : 0, om_frac: 0, hub_m: hub, ref_m: sw ? sw.ref_m : hub, alpha: b.windAlpha == null ? 0.14 : b.windAlpha });
    Object.assign(c.battery, { P_MW: b.batMW, E_MWh: b.batMWh, capex_EURkWh: b.batCapex, om_frac: 0, life: cm.battery ? cm.battery.life : 15 });
    c.grid = { enabled: b.gridMW > 0, auxBackup_MW: b.auxBackupMW || 0, import_MW: b.gridMW, mode: b.gridMode || 'fill', target: b.gridTarget == null ? 0.6 : b.gridTarget, price_EURMWh: b.pel, CI_gkWh: b.gridCI,
      export: !isl && b.surplus === 'export', export_price: b.exportPrice,
      price_series: sp ? sp.series : null, CI_series: sc ? sc.series : null, price_cap: b.gridPriceCap == null ? 50 : b.gridPriceCap, lowPriceRule: !!sp && b.lowPriceRule !== 'off', ets_EURt: b.etsPrice || 0,
      export_series: sp && b.exportPricing === 'spot' ? sp.series : null };
    Object.assign(c.ely, { tech: b.tech, P_MW: P, modules: b.modules, minLoad: b.minLoad, capex_EURkW: b.capexEly, stack_frac: b.stackFrac, om_frac: 0, availability: b.availability, soecHeat: b.soecHeat || 'electric', standby_frac: null });
    // library components: technology overrides, power electronics, balance of plant, PV, wind, battery and compressor data
    if (ov.tp) c.ely.tp = ov.tp; if (ov.eta_rect) c.ely.eta_rect = ov.eta_rect; if (ov.k_BoP != null) c.ely.k_BoP = ov.k_BoP; if (ov.fixBoP != null) c.ely.BoP_fixed_frac = ov.fixBoP;
    if (ov.pv) Object.assign(c.pv, { tracking: ov.pv.tracking, losses: ov.pv.losses, dcac: ov.pv.dcac, gammaT: ov.pv.gammaT });
    if (ov.wind) Object.assign(c.wind, { v_in: ov.wind.v_in, v_rated: ov.wind.v_rated, v_out: ov.wind.v_out, losses: ov.wind.losses });
    if (ov.bat) Object.assign(c.battery, { eta_rt: ov.bat.eta_rt, soc_min: ov.bat.soc_min, soc_max: ov.bat.soc_max });
    c.aux.P_MW = P * b.auxFrac;
    const mdotEst = design ? design.data.mdot : P * 1000 / 55;
    const sizeKg = b.storeSizing === 'days' ? mdotEst * 24 * b.storeDays * (b.storeFrac == null ? 1 : b.storeFrac) : 0;
    Object.assign(c.storage, { enabled: true, flex_h: b.flex_h, turndown: b.turndown, p_max: b.storeP, p_min: b.storePmin, comp_p_in: Math.max(1.013, tp.pH2 - 1), comp_T1: H2.coolOutlet(b.Tamb), Tlim: b.Tdis || 120, capex_EURkg: b.storeCapex, size_kg: sizeKg });
    if (ov.cmp) Object.assign(c.storage, { comp_rmax: ov.cmp.rmax, comp_eta_s: ov.cmp.etaS });
    const Y = b.Y1 * b.Y2 / (1 - b.Y1 * (1 - b.Y2));
    Object.assign(c.water, { w_DI: b.wDI, Y, price_EURm3: b.waterPrice });
    const elyCap = P * 1000 * b.capexEly / 1e6, batCap = b.batMWh * 1000 * b.batCapex / 1e6;
    const storeEst = (design ? design.data.m_st : mdotEst * 24) * b.storeCapex / 1e6;
    const CAPEXd = design ? design.data.cap.CAPEX : elyCap * (1 + b.otherCapexFrac) * 1.2768;
    Object.assign(c.econ, { WACC: b.WACC, life: b.life, other_capex_MEUR: Math.max(0, elyCap * b.otherCapexFrac - batCap - storeEst), fixed_opex_MEUR: b.fixedOpexFrac * CAPEXd, ppa_price_EURMWh: isl ? 0 : b.pel,
      heat_price: b.heatPrice || 0, replacements: H2.replacementItems ? H2.replacementItems(b, elyCap, false) : [] });
    return c;
  };

  /* ---------- helpers ---------- */
  const rhoO2 = (p, T) => p * 1e5 * 0.031998 / (C.R * T);
  const STD_MVA = [0.5, 0.63, 0.8, 1.0, 1.25, 1.6, 2.0, 2.5, 3.15, 4.0, 5.0, 6.3, 8.0, 10, 12.5, 16, 20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315];
  const stdMVA = s => STD_MVA.find(v => v >= s) || Math.ceil(s);
  const DN = [25, 40, 50, 80, 100, 150, 200, 250, 300, 350, 400, 500, 600, 700, 800, 900, 1000, 1200];
  const round = (v, d) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  const wetWater = (T, p) => { const y = Math.min(0.95, H2.pSatWater(T) / p); return C.w_H2O * y / (1 - y); };   // kg H2O per kg H2 (CM 8.3)
  const wetO2 = (T, p) => { const y = Math.min(0.95, H2.pSatWater(T) / p); return (C.M_H2O / C.M_O2) * y / (1 - y); }; // kg H2O per kg O2
  // demineralised-water quality usually specified by the stack makers (ASTM D1193 types, ISO 3696 grades)
  H2.DI_SPEC = { PEM: '≤ 0.1 µS/cm at the stack (ASTM D1193 Type I–II, ISO 3696 grade 1)', AEL: '≤ 5 µS/cm (ASTM D1193 Type IV)', AEM: '≤ 1 µS/cm (ASTM D1193 Type II)', SOEC: '≤ 1 µS/cm steam-generator feed (ASTM D1193 Type II)' };
  // ISO 14687:2025 grade D (fuel-cell vehicles), µmol/mol, and minimum hydrogen fraction
  H2.ISO14687_D = { H2: 0.9997, H2O: 5, O2: 5, N2: 300, total: 300 };
  // IEEE 519-2022 Table 2 (120 V – 69 kV): TDD limit by short-circuit ratio I_sc/I_L; Table 1 voltage THD limits by bus voltage
  H2.ieee519TDD = r => (r < 20 ? 5 : r < 50 ? 8 : r < 100 ? 12 : r < 1000 ? 15 : 20);
  H2.ieee519THDv = kV => (kV <= 1 ? 8 : kV <= 69 ? 5 : kV <= 161 ? 2.5 : 1.5);
  // Seveso III qualifying quantities (t, lower / upper tier) and US thresholds (kg): OSHA PSM 10 000 lb, EPA RMP 10 000 lb
  H2.SEVESO = { hydrogen: { QL: 5, QU: 50, groups: ['P'] }, ammonia: { QL: 50, QU: 200, groups: ['P', 'H'] } };
  H2.US_TQ_KG = 4536;
  H2.majorAccident = function (inv) {
    // inv: { hydrogen: t, ammonia: t } – summation rule of Annex I note 4 per hazard group; ≤ 2 % of the lower quantity ignored
    const res = { items: [], P: { L: 0, U: 0 }, H: { L: 0, U: 0 } };
    Object.keys(inv).forEach(k => { const q = inv[k] || 0, s = own(H2.SEVESO, k); if (!s || !(q > 0)) return; const ignored = q <= 0.02 * s.QL;
      res.items.push({ substance: k, q, QL: s.QL, QU: s.QU, ignored, tier: q >= s.QU ? 'upper tier' : q >= s.QL ? 'lower tier' : 'below threshold' });
      if (!ignored) s.groups.forEach(g => { res[g].L += q / s.QL; res[g].U += q / s.QU; }); });
    const maxU = Math.max(res.P.U, res.H.U), maxL = Math.max(res.P.L, res.H.L);
    res.tier = maxU >= 1 ? 'upper tier' : maxL >= 1 ? 'lower tier' : 'below threshold'; res.sumL = maxL; res.sumU = maxU;
    res.psm = (inv.hydrogen || 0) * 1000 >= H2.US_TQ_KG || (inv.ammonia || 0) * 1000 >= H2.US_TQ_KG;
    res.rmp = res.psm;                                     // both substances have a 10 000 lb threshold in 40 CFR 68.130
    return res;
  };

  /* =====================================================================
     SOLVE SYSTEM
     ===================================================================== */
  H2.solveSystem = function (basisIn) {
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const nb = H2.normalizeBasis(basisIn), b = nb.b;
    const ov = H2.compModel ? H2.compModel(b) : {}, CM = b.comp || {};
    const design = H2.designPlant(b); const d = design.data; const tp = d.tp;
    const cfg = H2.hourlyFromBasis(b, design); const annual = H2.hourly(cfg); const A = annual.kpi;
    const P = b.modules * b.moduleMW, nMod = b.modules;
    const tech = b.tech, isPEM = tech === 'PEM', isAEL = tech === 'AEL', isAEM = tech === 'AEM', isSOEC = tech === 'SOEC';
    const Tst = tp.T_C, pH2 = tp.pH2, pO2 = tp.pO2;
    const nom = d.nom;                              // rated operating point (BoL)
    const mStack = nom.mdot_kgh;                    // kg/h H2 leaving the stacks
    const gp = H2.gasProcessing(tech), yO2 = gp.yO2, tsaLoss = gp.tsa;   // O2 in H2 before deoxo (mole fraction), dryer purge
    const mDeoxo = mStack * 2 * yO2;                // H2 consumed in deoxo (CM 8.4, mass basis ≈ mole basis × M ratio)
    const mAfterDeoxo = mStack - mDeoxo;
    const mProd = mAfterDeoxo * (1 - tsaLoss);
    const mO2 = C.w_O2 * mStack;
    const Tamb = b.Tamb, Tlt = d.Tlt;              // gas-cooler outlet and compressor suction (air cooling, 10 K approach)
    const E = {}, S = [], equip = [], checks = [], msgs = [];
    nb.notes.forEach(t => msgs.push({ level: 'warn', tag: 'Basis', text: 'Design basis corrected: ' + t + '.' }));
    const eq = (tag, name, sym, group, props, extra) => { const o = Object.assign({ tag, name, sym, group, props, warn: [] }, extra || {}); equip.push(o); E[tag] = o; return o; };
    const stream = (key, name, from, to, type, phase, T, p, comp, note) => {
      let m = 0; for (const k in comp) m += comp[k] || 0;
      const o = { no: S.length + 1, key, name, from, to, type, phase, T, p, m, comp, note: note || '' }; S.push(o); return o;
    };

    /* ---------------- electrolyser & stack ---------------- */
    const cell = d.cell, st = d.stack;
    const stacksPerMod = Math.max(1, st.Nst), nStacks = stacksPerMod * nMod;
    const V_dc = st.V;
    const PDC_mod = b.moduleMW * 1000 * 0.96;         // kW DC per module (the stacks share the module rating)
    const I_mod = PDC_mod * 1000 / V_dc;              // A, stacks of one module in parallel on the DC bus
    const cellStack = {
      tech, techName: tp.name, T: Tst, pH2, pO2, j: tp.jnom, Acell: tp.Acell, cells: tp.cells, cell, I: st.I, V: st.V, Pst: st.P, stacksPerMod, nMod, nStacks,
      Atot_m2: d.area.A, catalyst_kg: d.area.mcat, degr: d.deg, polar: H2.polarization(tp, tp.jlim * 0.95, 50), minLoadX: d.minL.xH2inO2, minLoad: d.minEff, sysNom: nom
    };
    const alarm = H2.GAS_ALARM;
    eq('EL-101', 'Electrolyser modules', 'electrolyser', 'Electrolysis', [
      ['Technology', tp.name, ''], ['Modules × rating', nMod + ' × ' + b.moduleMW, 'MW'], ['Stacks per module', stacksPerMod, '–'], ['Cells per stack', tp.cells, '–'],
      ['Cell active area', tp.Acell, 'cm²'], ['Current density (rated)', tp.jnom, 'A/cm²', 'CM 4.4'], ['Cell voltage (rated, BoL)', cell.Ecell, 'V', 'CM 4.4'],
      ['Stack current / voltage', Math.round(st.I) + ' A / ' + round(st.V, 1) + ' V', '', 'CM 6.1'], ['Stack power', st.P, 'kW', 'CM 6.1'],
      ['Operating T / p(H₂) / p(O₂)', Tst + ' °C / ' + pH2 + ' / ' + pO2 + ' bar', ''], ['Faradaic efficiency', cell.etaF, '–', 'CM 7.6'],
      ['SEC stack / system (rated)', round(nom.SEC_stack, 1) + ' / ' + round(nom.SEC_sys, 1), 'kWh/kg', 'CM 7.5/7.8'],
      ['H₂ production (rated, stack outlet)', mStack, 'kg/h', 'CM 4.2'], ['Stack replacement interval (' + d.lifeD.limitedBy + ')', d.lifeD.tRep, 'h', 'CM 6.6'], ['Minimum load (design basis / operating)', (100 * d.minBasis).toFixed(0) + ' % / ' + (100 * d.minEff).toFixed(0) + ' %', ''],
      ['H₂ in O₂ at the operating minimum load', 100 * d.minL.xH2inO2, '%', 'CM 7.7'], ['Gas analysers H₂ in O₂ and O₂ in H₂', 'alarm ' + 100 * alarm.alarm + ' %, trip ' + 100 * alarm.trip + ' % (interlocked shutdown)', '', 'ISO 22734-1'],
      ['Hall gas detection', 'alarm 10 % LFL, shutdown 25 % LFL (1 vol-% H₂)', '', 'ISO 22734-1'], ['Total active area', d.area.A, 'm²', 'CM 5.1']], { count: nMod });
    if (d.minL.xH2inO2 > alarm.trip + 1e-9) E['EL-101'].warn.push('H₂-in-O₂ ' + (100 * d.minL.xH2inO2).toFixed(1) + ' % at the minimum load exceeds the ' + 100 * alarm.trip + ' % trip (CM 7.7, DM 10.2).');
    if (d.Lpur > d.minBasis + 1e-9) msgs.push({ level: 'warn', tag: 'EL-101', text: 'Operating minimum load raised from ' + (100 * d.minBasis).toFixed(0) + ' % to ' + (100 * d.minEff).toFixed(0) + ' %: at lower loads hydrogen in oxygen would exceed the ' + 100 * alarm.trip + ' % trip (CM 7.7, DM 10.2).' });
    if (A.repl_limit === 'degradation' && tp.stackLife_h > A.t_rep_h * 1.05) msgs.push({ level: 'info', tag: 'EL-101', text: 'Stacks are replaced every ' + Math.round(A.t_rep_h) + ' operating hours, when the cell voltage has risen by 10 % at ' + tp.degr_uVh + ' µV/h (CM 6.6) – earlier than the stated life of ' + tp.stackLife_h + ' h.' });

    /* ---------------- design-point streams ---------------- */
    const Yov = d.w.Y, rhoRaw = b.TDS > 10 ? 1025 : 1000;
    const DI_kgh = b.wDI * mProd;                   // DI make-up (includes losses), DM 6.1
    const raw_m3h = DI_kgh / 1000 / Yov;
    const brine_m3h = raw_m3h - DI_kgh / 1000;
    const TDSc = R('DM-8.1', { cf: b.TDS, Y: b.Y1, Rs: 0.997 });
    const wSt = isSOEC ? 0 : wetWater(Tst, pH2);     // vapour in wet H2
    const wLt = wetWater(Tlt, pH2);
    const wO2st = isSOEC ? 0 : wetO2(Tst, pO2), wO2Lt = wetO2(Tlt, pO2);
    const condH2 = Math.max(0, (wSt - wLt) * mStack), condO2 = Math.max(0, (wO2st - wO2Lt) * mO2);
    // electrolyte / water circulation (DM 10.1), per plant
    const lye = { rho: isAEL ? 1290 : isAEM ? 1050 : 972, cp: isAEL ? 3.0 : isAEM ? 3.9 : 4.19, dT: 10, name: isAEL ? 'KOH 30 wt-%' : isAEM ? 'KOH 1 M' : 'DI water' };
    const Qst_kW = d.heat.Q * 1000;                  // stack heat to loop, BoL (DM 9.1)
    const lyeFlow_kgh = isSOEC ? 0 : Qst_kW / (lye.cp * lye.dT) * 3600;   // kg/h
    const lyeFlow_m3h = lyeFlow_kgh / lye.rho;
    // SOEC: steam feed with 70 % utilisation
    const steamIn = isSOEC ? C.w_H2O * mStack / 0.7 : 0;
    const coolLoop = d.loop;
    const coolFlow = (d.Qtot * 1000) / (4.0 * (coolLoop.Tret - coolLoop.Tsup)) * 3600;  // glycol-water kg/h
    const deoxoDT = R('CM-8.4', { y: yO2, m: mStack }).dT;
    const avgFlow = A.H2_t * 1000 / 8760;             // annual average kg/h
    // product purity after deoxo and TSA dryer (ISO 14687): O₂ ≤ 1 µmol/mol (Pd deoxo), water at the −70 °C frost point of the dryer pressure, N₂ + Ar from purging
    const pDry = d.p1c;                              // dryer outlet = compressor suction (1 bar below the stack)
    const imp = { O2: 1, H2O: H2.pIce(-70) / (pDry * 1e5) * 1e6, N2: 10 };
    const purity = 1 - (imp.O2 + imp.H2O + imp.N2) * 1e-6;
    const purTxt = (100 * purity).toFixed(4) + ' %';
    // water treatment
    const salts = raw_m3h * b.TDS;                   // kg/h (g/L × m³/h)
    stream('raw', 'Raw water intake', b.TDS > 10 ? 'Sea intake' : 'Supply main', 'WT-101', 'water', 'L', b.Twater, 3, { H2O: raw_m3h * rhoRaw - salts, TDS: salts }, 'TDS ' + b.TDS + ' g/L');
    const cBrine = salts / Math.max(brine_m3h, 1e-9);  // g/L
    stream('brine', 'RO concentrate / brine', 'WT-101', b.TDS > 10 ? 'Outfall' : 'Sewer', 'water', 'L', b.Twater + 1, 1.5, { H2O: brine_m3h * (1000 + 0.75 * cBrine) - salts, TDS: salts }, 'TDS ' + round(cBrine, 1) + ' g/L');
    stream('di', 'Demineralised water', 'WT-101', 'TK-101', 'water', 'L', b.Twater + 2, 2, { H2O: DI_kgh }, H2.DI_SPEC[tech].replace(/ \(.*/, ''));
    stream('makeup', 'DI make-up + condensate', 'TK-101', isSOEC ? 'E-103' : 'Electrolyte loop', 'water', 'L', 30, pH2 + 2, { H2O: DI_kgh + condH2 + condO2 }, 'P-101');
    if (!isSOEC) {
      stream('cath', 'Cathode outlet (H₂ + ' + (isPEM ? 'water' : 'electrolyte') + ')', 'EL-101', 'V-101', 'h2', 'V/L', Tst, pH2, { H2: mStack, H2O: wSt * mStack + (isPEM ? 0.1 : 0.5) * lyeFlow_kgh * (isAEL ? 0.7 : 1), KOH: isAEL ? 0.5 * lyeFlow_kgh * 0.3 : 0 }, 'two-phase');
      stream('anod', 'Anode outlet (O₂ + ' + (isPEM ? 'water' : 'electrolyte') + ')', 'EL-101', 'V-102', 'o2', 'V/L', Tst, pO2, { O2: mO2, H2O: wO2st * mO2 + (isPEM ? 0.9 : 0.5) * lyeFlow_kgh * (isAEL ? 0.7 : 1), KOH: isAEL ? 0.5 * lyeFlow_kgh * 0.3 : 0 }, 'two-phase');
      stream('ret', (isPEM ? 'Water' : 'Electrolyte') + ' return', 'V-101/V-102', 'P-102', 'lye', 'L', Tst, Math.min(pH2, pO2), { H2O: lyeFlow_kgh * (isAEL ? 0.7 : 1), KOH: isAEL ? lyeFlow_kgh * 0.3 : 0 }, lye.name);
      stream('feed', (isPEM ? 'Cooled water' : 'Cooled electrolyte') + ' to stacks', 'E-101', 'EL-101', 'lye', 'L', Tst - lye.dT, Math.min(pH2, pO2) + 2, { H2O: lyeFlow_kgh * (isAEL ? 0.7 : 1), KOH: isAEL ? lyeFlow_kgh * 0.3 : 0 }, round(lyeFlow_m3h, 1) + ' m³/h');
    } else {
      stream('steam', 'Steam feed', 'E-103', 'EL-101', 'water', 'V', 750, 1.2, { H2O: steamIn }, 'utilisation 70 %');
      stream('cath', 'Fuel-side outlet (H₂ + steam)', 'EL-101', 'V-101', 'h2', 'V', 150, 1.1, { H2: mStack, H2O: steamIn - C.w_H2O * mStack }, 'after recuperator');
      stream('anod', 'Sweep-air + O₂ outlet', 'EL-101', 'VS-402', 'o2', 'V', 150, 1.05, { O2: mO2, N2: mO2 * 1.5 }, 'air sweep');
    }
    stream('wetH2', 'Wet hydrogen', 'V-101', 'E-102', 'h2', 'V', isSOEC ? 150 : Tst, pH2, { H2: mStack, H2O: isSOEC ? (steamIn - C.w_H2O * mStack) : wSt * mStack }, 'saturated');
    stream('cond', 'Condensate return', 'E-102', 'TK-101', 'water', 'L', Tlt, 1.5, { H2O: condH2 + condO2 + (isSOEC ? steamIn - C.w_H2O * mStack - wLt * mStack : 0) }, 'recycled');
    stream('coolH2', 'Cooled hydrogen', 'E-102', 'R-101', 'h2', 'V', Tlt, pH2 - 0.3, { H2: mStack, H2O: wLt * mStack, O2: yO2 * mStack * 16 }, (yO2 * 1e6).toFixed(0) + ' ppm O₂');
    stream('deoxo', 'Deoxidised hydrogen', 'R-101', 'D-101', 'h2', 'V', Tlt + deoxoDT, pH2 - 0.6, { H2: mAfterDeoxo, H2O: wLt * mStack + 9 * mDeoxo }, 'ΔT ' + round(deoxoDT, 1) + ' K');
    stream('dry', 'Dry hydrogen ' + purTxt, 'D-101', 'CP-201', 'h2', 'V', Tlt, pDry, { H2: mProd }, 'frost point −70 °C');
    stream('o2', 'Oxygen to vent', 'V-102', 'VS-402', 'o2', 'V', isSOEC ? 150 : Tlt, isSOEC ? 1.05 : Math.max(1.05, pO2 - 0.3), isSOEC ? { O2: mO2, N2: mO2 * 1.5 } : { O2: mO2, H2O: wO2Lt * mO2, H2: mO2 * d.cell.xH2inO2 / 16 }, (100 * d.cell.xH2inO2).toFixed(2) + ' % H₂');
    /* ---------------- compression train (DM 12.1, API 618 discharge-temperature limit) ---------------- */
    const p1c = d.p1c, Tlim = d.Tlim, esC = ov.cmp ? ov.cmp.etaS : H2.COMP_ETA.s, rC = Math.min(ov.cmp ? ov.cmp.rmax : 2.3, d.rT);
    const nComp = Math.max(1, Math.ceil(mProd / (ov.cmp ? ov.cmp.flowMax : 500)));
    const stages = [];
    let cN = 0, rc = 1;
    if (b.storeP > p1c) {
      cN = H2.compress(p1c, b.storeP, Tlt, { rmax: rC, eta_s: esC }).N; rc = Math.pow(b.storeP / p1c, 1 / cN);
      for (let i = 0; i < cN; i++) { const pin = p1c * Math.pow(rc, i), pout = pin * rc; const c1 = H2.compress(pin, pout, Tlt, { N: 1, eta_s: esC, eta_mech: H2.COMP_ETA.mech, eta_motor: H2.COMP_ETA.motor, mdot_kgh: mProd }); stages.push({ i: i + 1, pin, pout, T1: Tlt, T2: c1.T2_C, P: c1.P_kW, Q: c1.P_kW * 0.9, Z: (H2.Z(pin, K(Tlt)) + H2.Z(pout, K(Tlt))) / 2 }); }
    }
    const T2c = stages.length ? Math.max(...stages.map(q => q.T2)) : null;
    const compTrain = { stages, N: cN, r: rc, T1: Tlt, Tlim, rT: d.rT, T2: T2c, P: stages.reduce((a, s) => a + s.P, 0), SEC: stages.reduce((a, s) => a + s.P, 0) / mProd, m: mProd, p1: p1c, p2: b.storeP, units: nComp, bypass: !stages.length };
    const sComp = stream('comp', stages.length ? 'Compressed hydrogen' : 'Hydrogen to storage (no compressor)', stages.length ? 'CP-201' : 'D-101', 'ST-201', 'h2', 'V', Tlt, b.storeP, { H2: mProd }, stages.length ? cN + ' stages' : 'storage below suction pressure');
    // end use
    const nh3 = b.product === 'NH3', nh3Y = d.nh3Y;
    let sDeliver;
    if (nh3) {
      const mNH3 = b.demand / 8000 * 1000; // kg/h rated loop
      sDeliver = stream('deliver', 'Hydrogen to ammonia loop', 'ST-201', 'NH-301', 'h2', 'V', 40, 150, { H2: H2.NH3.h2 * mNH3 / nh3Y }, 'via make-up compressor');
      const air = (1 - H2.NH3.h2) * mNH3 / nh3Y / 0.755 / 0.9;
      stream('air', 'Air to ASU', 'Atmosphere', 'AS-301', 'air', 'V', Tamb, 1.01, { N2: air * 0.755, O2: air * 0.232, other: air * 0.013 }, '90 % N₂ recovery');
      stream('n2', 'Nitrogen 99.999 %', 'AS-301', 'NH-301', 'n2', 'V', 40, 150, { N2: (1 - H2.NH3.h2) * mNH3 / nh3Y }, '');
      stream('nh3', 'Liquid ammonia', 'NH-301', 'TK-301', 'nh3', 'L', -33, 1.1, { NH3: mNH3 }, 'refrigerated');
    } else if (b.deliver === 'hrs') {
      sDeliver = stream('deliver', 'Hydrogen to dispensers', 'ST-201', 'HR-301', 'h2', 'V', -40, 875, { H2: b.demand / 20 * 1.25 }, 'pre-cooled −40 °C');
    } else {
      sDeliver = stream('deliver', 'Hydrogen to customer', 'ST-201', b.deliver === 'pipeline' && b.pipeKm > 0 ? 'PL-301' : 'Customer', 'h2', 'V', 15, b.pipeP, { H2: b.demand / 24 }, 'contract flow');
      if (b.trailer_kgd > 0) stream('trailer', 'Hydrogen to trailer bay', 'ST-201', 'TL-301', 'h2', 'V', 40, 500, { H2: b.trailer_kgd / 20 }, 'filling 20 h/d');
    }
    stream('coolRet', 'Coolant return (hot)', 'E-101/E-102/CP-201', 'CL-401', 'cool', 'L', coolLoop.Tret, 3, { H2O: coolFlow * 0.7, glycol: coolFlow * 0.3 }, round(d.Qtot, 2) + ' MW');
    stream('coolSup', 'Coolant supply (cold)', 'CL-401', 'E-101/E-102/CP-201', 'cool', 'L', coolLoop.Tsup, 4, { H2O: coolFlow * 0.7, glycol: coolFlow * 0.3 }, 'glycol-water');
    S.forEach(s => { s.V = s.phase === 'V' ? s.m / Math.max(1e-9, s.type === 'h2' ? H2.rho(Math.max(s.p, 1), K(Math.max(s.T, -200))) : s.type === 'o2' ? rhoO2(s.p, K(s.T)) : (s.type === 'nh3' ? 682 : 1.2 * s.p)) : s.m / (s.type === 'lye' ? lye.rho : s.type === 'nh3' ? 682 : 1000); });

    /* ---------------- gas processing and utility equipment ---------------- */
    const nGP = Math.max(1, Math.ceil(mStack / 500));
    const sepSize = (m_kgh, rhoG, K_sb) => { const rhoL = isAEL ? 1290 : 972; const u = K_sb * Math.sqrt((rhoL - rhoG) / rhoG); const Q = m_kgh / 3600 / rhoG; const Dm = Math.sqrt(4 * Q / (Math.PI * u)); return { u, Q, D: Math.max(0.3, Math.ceil(Dm * 10) / 10) }; };
    const rhoH2st = H2.rho(pH2, K(Tst)), rhoO2st = rhoO2(pO2, K(Tst));
    const sepH = sepSize(mStack / nMod, rhoH2st, 0.05), sepO = sepSize(mO2 / nMod, rhoO2st, 0.05);
    eq('V-101', 'H₂ / ' + (isPEM ? 'water' : 'electrolyte') + ' separator', 'vessel', 'Gas processing', [
      ['Per module', nMod, '×'], ['Gas flow per module', mStack / nMod, 'kg/h'], ['Gas density', rhoH2st, 'kg/m³', 'CM 2.4'], ['Max. gas velocity (Souders–Brown)', sepH.u, 'm/s', 'DM 10.1'],
      ['Diameter', sepH.D, 'm', 'DM 10.1'], ['Operating p / T', pH2 + ' bar / ' + Tst + ' °C', ''], ['PED 2014/68/EU category (group 1 gas)', H2.pedCategory(pH2 * 1.1, Math.PI / 4 * sepH.D * sepH.D * 3 * sepH.D * 1000), '', 'PED Annex II']], { count: nMod });
    eq('V-102', 'O₂ / ' + (isPEM ? 'water' : 'electrolyte') + ' separator', 'vessel', 'Gas processing', [
      ['Per module', nMod, '×'], ['Gas flow per module', mO2 / nMod, 'kg/h'], ['Gas density', rhoO2st, 'kg/m³'], ['Max. gas velocity', sepO.u, 'm/s', 'DM 10.1'], ['Diameter', sepO.D, 'm', 'DM 10.1'], ['H₂ in O₂ (rated)', 100 * d.cell.xH2inO2, '%', 'CM 7.7']], { count: nMod });
    const pumpP = lyeFlow_m3h / 3600 * lye.rho * 9.81 * 30 / 0.7 / 1000;
    if (!isSOEC) eq('P-102', (isPEM ? 'Water' : 'Electrolyte') + ' circulation pump', 'pump', 'Gas processing', [['Flow (plant)', lyeFlow_m3h, 'm³/h', 'DM 10.1'], ['Flow per module', lyeFlow_m3h / nMod, 'm³/h'], ['Head / efficiency', '30 m / 70 %', ''], ['Shaft power (plant)', pumpP, 'kW']], { count: nMod });
    const lmtd = 10; const hxA = Qst_kW * 1000 / (1500 * lmtd);
    if (!isSOEC) eq('E-101', (isPEM ? 'Water' : 'Electrolyte') + ' cooler', 'hx', 'Gas processing', [['Duty (BoL / end of stack life)', round(d.heat.Q, 2) + ' / ' + round(d.heat.QEoL, 2), 'MW', 'DM 9.1'], ['Hot side', Tst + ' → ' + (Tst - lye.dT) + ' °C', ''], ['Cold side', coolLoop.Tsup + ' → ' + coolLoop.Tret + ' °C', ''], ['LMTD', lmtd, 'K'], ['Plate area (U 1500 W/m²K)', hxA, 'm²', 'DM 9.2']], { count: nMod });
    else {
      const qEndo = C.kSEC * Math.max(0, d.cell.Etn - d.cell.Ecell) * mStack / 1000, qSteam = 6.6 * mStack / 1000, ext = b.soecHeat === 'external';
      eq('E-103', 'Steam generator / recuperator', 'hx', 'Gas processing', [['Steam flow', steamIn, 'kg/h'], ['Steam utilisation', 0.7, '–'], ['Evaporation duty (incl. excess steam)', steamIn * 2257 / 3600 / 1000, 'MW', 'CM 3.12'],
        ['Steam raising in the energy balance', qSteam, 'MW', 'CM 3.12'], ['Heat supply for steam', ext ? 'external heat (' + b.heatPrice + ' EUR/MWh)' : 'electric boiler', ''], ['Stack heat demand below E_tn (rated)', qEndo, 'MW', 'CM 3.12'], ['Trim heaters', 'electric, η 0.98', '']]);
    }
    const QcoolH2 = (mStack * 14.3 * ((isSOEC ? 150 : Tst) - Tlt) + (condH2) * 2400) / 3600;
    eq('E-102', 'Hydrogen gas cooler / condenser', 'hx', 'Gas processing', [['Trains', nGP, '×'], ['Gas in → out', (isSOEC ? 150 : Tst) + ' → ' + Tlt + ' °C', ''], ['Condensate', condH2, 'kg/h', 'CM 8.3'], ['Duty', QcoolH2, 'kW', 'CM 8.3']], { count: nGP });
    eq('R-101', 'Deoxo reactor (Pd)', 'reactor', 'Gas processing', [['Trains', nGP, '×'], ['O₂ in feed', yO2 * 1e6, 'ppm(v)'], ['Adiabatic ΔT', deoxoDT, 'K', 'CM 8.4'], ['H₂ consumed', mDeoxo, 'kg/h', 'CM 8.4'], ['O₂ at outlet (design)', '≤ 1 µmol/mol', '']], { count: nGP });
    eq('D-101', 'TSA dryer (twin bed)', 'dryer', 'Gas processing', [['Trains', nGP, '×'], ['Water removed', wLt * mStack + 9 * mDeoxo, 'kg/h', 'CM 8.3'], ['Product frost point', '−70 °C at ' + round(pDry, 1) + ' bar', ''], ['Regeneration loss', 100 * tsaLoss, '%'],
      ['Product purity', purTxt, '', 'ISO 14687'], ['Impurities O₂ / H₂O / N₂ + Ar', round(imp.O2, 2) + ' / ' + round(imp.H2O, 2) + ' / ' + imp.N2, 'µmol/mol', 'ISO 14687']], { count: nGP });
    eq('CP-201', 'Hydrogen compressor (reciprocating, oil-free)', 'compressor', 'Compression', [['Machines', stages.length ? nComp + ' + 1' : 'none (bypass)', ''], ['Suction / discharge', round(p1c, 1) + ' → ' + b.storeP, 'bar'], ['Suction temperature (intercooled, air)', Tlt, '°C', 'DM 12.1'],
      ['Discharge temperature limit', Tlim, '°C', 'API 618'], ['Stages / ratio', cN + ' / ' + round(rc, 2), '', 'DM 12.1'],
      ['Stage discharge temperature', T2c == null ? '–' : T2c, '°C', 'DM 12.1'], ['Specific energy', compTrain.SEC, 'kWh/kg', 'DM 12.2'], ['Shaft power', compTrain.P, 'kW', 'DM 12.2'], ['Intercooling duty', compTrain.P * 0.9, 'kW', 'DM 12.2']], { count: stages.length ? nComp : 1 });
    if (T2c != null && T2c > Tlim + 0.5) E['CP-201'].warn.push('Stage discharge ' + T2c.toFixed(0) + ' °C exceeds ' + Tlim + ' °C (API 618) – add a stage (DM 12.1).');
    if (!stages.length) E['CP-201'].warn.push('Storage pressure ' + b.storeP + ' bar does not exceed the suction pressure ' + round(p1c, 1) + ' bar – no compressor is needed.');
    // storage
    const storeUsable = b.storeSizing === 'hourly' ? A.buffer_t * 1000 : d.m_st;
    const vol = R('DM-13.1', { mu: storeUsable, pmax: b.storeP, pmin: b.storePmin, T: 25 });
    const vessel = H2.vesselWall(b.storeP);
    const vesselVol = vessel.V;     // m³ per vessel / tube bundle / pipe string
    const nVessels = Math.max(1, Math.ceil(vol.V / vesselVol));
    let Tmin = Infinity; for (let h = 0; h < 8760; h++) if (annual.series.tam[h] < Tmin) Tmin = annual.series.tam[h];
    const invCold = vol.V * H2.rho(b.storeP, K(Math.min(Tmin, 25)));   // inventory at the lowest ambient temperature (Seveso)
    eq('ST-201', 'Hydrogen storage', 'storage', 'Storage', [['Sizing basis', b.storeSizing === 'hourly' ? 'hourly inventory (DM 13.1)' : b.storeDays + ' d of full-load flow', ''], ['Usable mass', storeUsable, 'kg', 'DM 13.1'], ['Pressure range', b.storePmin + '–' + b.storeP, 'bar'],
      ['Density at p_max / p_min', round(vol.rmax, 2) + ' / ' + round(vol.rmin, 2), 'kg/m³', 'CM 2.4'], ['Geometric volume', vol.V, 'm³', 'DM 13.2'], ['Units (' + vesselVol + ' m³, D ' + vessel.D + ' m)', nVessels, '–'], ['Total inventory at 25 °C / at ' + round(Math.min(Tmin, 25), 0) + ' °C', round(vol.mtot, 0) + ' / ' + round(invCold, 0), 'kg', 'CM 9.1'],
      ['Shell ' + vessel.rule, vessel.tDiv1, 'mm', 'DM 13.3'], ['Shell ASME VIII-2 / EN 13445', round(vessel.t2, 1) + ' / ' + round(vessel.e, 1), 'mm', 'DM 13.3/13.5'], ['PED 2014/68/EU category (group 1 gas)', H2.pedCategory(b.storeP * 1.1, vesselVol * 1000) + ' – modules B + D/F, G or H1', '', 'PED Annex II'],
      ['Material', 'steel R_m ≤ 950 MPa, R_e/R_m ≤ 0.9 (hydrogen compatibility)', '', 'ISO 11114-4']]);
    if (!vessel.valid1) E['ST-201'].warn.push('Design pressure above 0.385·S·E: the ASME VIII-1 thin-shell formula does not apply – thick-wall App. 1-2 used; consider ASME VIII-2/-3 or EN 13445.');
    // water plant
    const lsi = R('DM-8.6', { TDS: TDSc.cc * 1000, T: K(b.Twater), Ca: b.Ca * 2.5 / (1 - b.Y1), Alk: b.Alk / (1 - b.Y1), pH: b.pH + 0.3 });
    const lsiOK = b.TDS <= 10;       // Langelier index for fresh and brackish water; seawater concentrates need the Stiff & Davis index
    const gyp = R('DM-8.7', { CF: 1 / (1 - b.Y1), TDS: TDSc.cc * 1000, Ca: b.Ca, SO4: b.SO4, Ksp: 2.5e-5 });
    gyp.valid = gyp.I <= 0.5;   // Davies activity model valid to I ≈ 0.5 mol/L; seawater concentrates need a Pitzer model
    const diffuser = b.TDS > 10 ? R('DM-8.8', { cb: TDSc.cc, ca: b.TDS, dc: 1.5, rb: 1000 + 0.75 * TDSc.cc, ra: 1000 + 0.75 * b.TDS, u0: 4, d0: 0.04 }) : null;
    // electricity of the water plant: high-pressure pumps per m³ of first-pass permeate, intake and pre-treatment per m³ of feed, second pass / EDI per m³ of product
    const water_kW = raw_m3h * b.Y1 * d.ro.s1 + raw_m3h * 0.25 + DI_kgh / 1000 * 0.3;
    const water = { raw: raw_m3h, brine: brine_m3h, DI: DI_kgh / 1000, Y1: b.Y1, Y2: b.Y2, Y: Yov, TDS: b.TDS, TDSc: TDSc.cc, perm: TDSc.cp, pf: d.pf, SEC_HP: d.ro.s1, ERD: b.TDS > 10, tank: d.tank.V, lsi, lsiValid: lsiOK, gyp, diffuser, lcow: d.lcow, seawater: b.TDS > 10, E_kW: water_kW, spec: H2.DI_SPEC[tech] };
    eq('WT-101', b.TDS > 10 ? 'Seawater RO + EDI water plant' : 'RO + EDI water plant', 'ro', 'Water', [['Raw water', raw_m3h, 'm³/h', 'DM 6.1'], ['Overall recovery', Yov, '–', 'DM 6.2'], ['DI water', DI_kgh / 1000, 'm³/h', 'DM 6.1'], ['Feed osmotic pressure', d.osm.pif, 'bar', 'DM 8.1'], ['Concentrate TDS', TDSc.cc, 'g/L', 'DM 8.2'],
      ['HP pump pressure', d.pf, 'bar', 'DM 8.3'], ['HP energy' + (b.TDS > 10 ? ' (with ERD)' : ''), d.ro.s1, 'kWh/m³', 'DM 8.4/8.5'], ['Electric power of the water plant', water_kW, 'kW', 'DM 8.4'], [lsiOK ? 'LSI of concentrate' : 'LSI of concentrate (indicative – use Stiff & Davis above 10 g/L)', lsi.LSI, '–', 'DM 8.6'], ['Gypsum saturation', gyp.valid ? gyp.S : 'n/a (I > 0.5)', '–', 'DM 8.7'], ['Cost of water (stand-alone plant)', d.lcow.LCOW, 'EUR/m³', 'DM 8.10']]);
    if (gyp.valid && gyp.S > 1) E['WT-101'].warn.push('Concentrate supersaturated in gypsum (S = ' + gyp.S.toFixed(2) + ') – antiscalant dosing required (DM 8.6).');
    if (lsi.LSI > 0) E['WT-101'].warn.push((lsiOK ? 'Positive LSI (' : 'Positive scaling index (LSI ' ) + lsi.LSI.toFixed(2) + (lsiOK ? ')' : ', indicative for seawater concentrate)') + ' – acid or antiscalant against CaCO₃ scaling (DM 8.6).');
    eq('TK-101', 'Demineralised-water tank', 'tank', 'Water', [['Volume', d.tank.V, 'm³', 'DM 6.3'], ['Treatment capacity', d.tank.Vp, 'm³/h', 'DM 6.3'], ['Water quality (typical stack specification)', H2.DI_SPEC[tech], '', 'ASTM D1193']]);
    eq('P-101', 'DI feed pump', 'pump', 'Water', [['Flow', (DI_kgh + condH2 + condO2) / 1000, 'm³/h'], ['Discharge pressure', pH2 + 2, 'bar']]);
    // cooling
    eq('CL-401', 'Dry coolers', 'aircooler', 'Utilities', [['Design duty (end of stack life + 15 %)', d.Qtot, 'MW', 'DM 9.1'], ['Design ambient', Tamb, '°C'], ['Coolant', coolLoop.Tret + ' → ' + coolLoop.Tsup + ' °C', ''], ['Air in → out', round(d.dry.Tai, 0) + ' → ' + round(d.dry.Tao, 0) + ' °C' + (d.dry.feasible ? '' : ' (adiabatic pre-cooling)'), ''], ['ΔT_lm', d.dry.dTlm, 'K', 'DM 9.2'], ['Finned area', d.dry.A, 'm²', 'DM 9.2'], ['Air flow', d.dry.Vair, 'm³/s', 'DM 9.3'], ['Fan power', d.dry.Pfan, 'kW', 'DM 9.3']]);
    if (coolLoop.Tsup - Tamb < 10) E['CL-401'].warn.push('Approach ' + (coolLoop.Tsup - Tamb).toFixed(0) + ' K < 10 K at design ambient: add adiabatic pre-cooling or a chiller (DM 9.3).');
    eq('VS-401', 'Hydrogen vent stack', 'vent', 'Safety', [['Height', b.modules > 4 ? 15 : 12, 'm'], ['Design', 'N₂ sweep, flame detection, no flame arrester', ''], ['Radiation limits at grade', '1.58 kW/m² continuous, 4.73 kW/m² emergency', '', 'EIGA Doc 211'], ['Reference', 'EIGA Doc 211, DM 18.4', '']]);
    eq('VS-402', 'Oxygen vent', 'vent', 'Safety', [['Flow', mO2, 'kg/h'], ['Rule', '≥ 3 m above roof, 10–15 m from intakes', '', 'DM 10.3'], ['Oxygen at openings', '< 23.5 vol-%', '', 'ISO 22734-1']]);
    // end use equipment
    let endUse = { type: nh3 ? 'nh3' : b.deliver };
    let hrsChk = null;
    if (nh3) {
      const mNH3 = b.demand / 8000;
      const syn = R('DM-15.3', { mNH3, eta: nh3Y, eASU: 0.12, wH2: 1, wN2: 0.14, eloop: 0.12 });
      const tankT = b.demand / 365 * 30; const tankV = tankT * 1000 / 682;
      endUse = Object.assign(endUse, { mNH3, syn, tankT, tankV, annualNH3: A.H2_t * nh3Y / H2.NH3.h2 });
      eq('NH-301', 'Ammonia synthesis loop', 'reactor', 'End use', [['Capacity', mNH3 * 24, 't/d', 'DM 15.2'], ['H₂ / N₂ feed', round(syn.mH2, 2) + ' / ' + round(syn.mN2, 2), 't/h', 'DM 15.2'], ['Loop pressure', 150, 'bar'], ['Synthesis electricity', syn.E, 'MWh/t', 'DM 15.3'], ['Reaction heat', syn.Q, 'MW', 'DM 15.1'], ['Annual ammonia (simulated)', A.H2_t * nh3Y / H2.NH3.h2, 't/a']]);
      eq('AS-301', 'Air separation unit', 'column', 'End use', [['Nitrogen', syn.mN2, 't/h'], ['Purity', '99.999 %', ''], ['Specific energy', 0.12, 'kWh/kg N₂', 'DM 15.3']]);
      eq('TK-301', 'Refrigerated ammonia tank', 'tank', 'End use', [['Holdup (30 d)', tankT, 't'], ['Volume', tankV, 'm³'], ['Conditions', '−33 °C, 1.1 bar', ''], ['Toxic end points (60 min)', 'AEGL-2 160 ppm, AEGL-3 1 100 ppm', '', 'US EPA AEGL']]);
    } else if (b.deliver === 'hrs') {
      const hrs = d.st || R('DM-16.1', { m: b.demand, fp: 0.12, top: 20, mg: 0.25, nb: 6, mf: 5, tb: 0.5, cp: 14.3, Tin: 25, Tout: -40, COP: 1.2 });
      const hf = d.hf || R('DM-16.3', { NWP: 700, T: 85 });
      const hc = H2.compress(b.storeP, 900, Tlt, { rmax: H2.rmaxForT(Tlt, Tlim, H2.COMP_ETA.s), mdot_kgh: hrs.comp });
      endUse = Object.assign(endUse, { hrs, hf, hc });
      hrsChk = { Tout: -40, pEnd: hf.p, casc: 900, MOP: 875 };
      eq('HR-301', 'Refuelling station 70 MPa', 'dispenser', 'End use', [['Daily sales', b.demand, 'kg/d'], ['Peak hour', hrs.peak, 'kg/h', 'DM 16.1'], ['Booster compressor', round(hrs.comp, 1) + ' kg/h, ' + hc.N + ' stages, ' + round(hc.P_kW, 0) + ' kW', '', 'DM 16.1'], ['Cascade 900 bar', hrs.casc, 'kg', 'DM 16.1'], ['Pre-cooling (T40)', hrs.Epc, 'kWh/kg', 'DM 16.2'], ['Hot-fill end pressure (85 °C)', hf.p, 'bar', 'DM 16.3'], ['Vehicle MOP (H70)', 875, 'bar', 'SAE J2601'], ['Dispensers', Math.max(1, Math.ceil(hrs.peak / 40)), '–'], ['Fuel quality', 'ISO 14687 grade D', '', 'ISO 14687']]);
    } else {
      // pipeline sizing: smallest DN with u ≤ 15 m/s and Δp ≤ 10 % over the length; wall to ASME B31.12 option A and EIGA Doc 121
      const flow = Math.max(b.demand / 24, mProd) / 3600; let pipe = null;
      if (b.deliver === 'pipeline' && b.pipeKm > 0) {        // a product pipeline only for pipeline delivery (not at the plant fence)
        for (const dn of DN) { const D = dn / 1000; const A2 = Math.PI * D * D / 4; const u = flow / (A2 * H2.rho(b.pipeP + 2, K(15))); const dp = (() => { const G = flow / A2; const p1 = (b.pipeP + 2) * 1e5; const p2sq = p1 * p1 - 0.015 * b.pipeKm * 1000 / D * G * G * 1.02 * C.Rs * K(15); return p2sq > 0 ? (p1 - Math.sqrt(p2sq)) / 1e5 : 99; })();
          if (u <= 15 && dp <= 0.1 * (b.pipeP + 2)) { const wall = H2.pipeWall(dn, b.pipeP + 2); pipe = { DN: dn, u, dp, wall, L: b.pipeKm, p: b.pipeP }; break; } }
      }
      endUse = Object.assign(endUse, { pipe, trailer: d.tr });
      if (pipe) eq('PL-301', 'Product pipeline', 'pipeline', 'End use', [['Length', pipe.L, 'km'], ['Size', 'DN' + pipe.DN + ' (OD ' + pipe.wall.OD + ' mm), X52 / L360', ''], ['Velocity at design flow', pipe.u, 'm/s', 'CM 13.1'], ['Pressure drop', pipe.dp, 'bar', 'CM 13.1'],
        ['Wall B31.12 option A (F 0.5, H_f ' + round(pipe.wall.Hf, 3) + ') / EN 1594', round(pipe.wall.tA, 2) + ' / ' + round(pipe.wall.tE, 2), 'mm', 'DM 14.2'], ['Selected wall (+1 mm corrosion, ≥ 6.4 mm)', pipe.wall.tSel, 'mm', 'EIGA Doc 121'], ['Hoop stress at operating pressure', 100 * pipe.wall.hoopFrac, '% SMYS', 'EIGA Doc 121'], ['Delivery pressure', pipe.p, 'bar']]);
      if (d.tr) eq('TL-301', 'Tube-trailer loading bay', 'trailer', 'End use', [['Daily loading', b.trailer_kgd, 'kg/d'], ['Trips per day', d.tr.n, '–', 'DM 14.3'], ['Trailers', d.tr.N, '–', 'DM 14.3'], ['Fill time', d.tr.tf, 'h', 'DM 14.3']]);
    }

    /* ---------------- power supply and electrical one-line ---------------- */
    const isl = b.supply === 'islanded';
    const cosA = 0.94; // firing angle ≈ 20° at rated current
    const thyristor = ov.psuType ? ov.psuType === 'thyristor' : isAEL;
    const Vdc0 = V_dc / (cosA - 0.05), VLL = Math.round(Vdc0 / 1.35 / 10) * 10;
    const rectRun = R('DM-5.1', { N: tp.cells, E: cell.Ecell, P: PDC_mod / 1000, VLL, dVx: 0.05, eta: thyristor ? 0.98 : 0.975, m: 0.08, p: 12 });
    const cosphi = thyristor ? rectRun.cosphi : 0.99;
    const ST = stdMVA(thyristor ? rectRun.ST : PDC_mod / 1000 / 0.975 / 0.99 * 1.08);
    const busbar = R('DM-5.3', { I: I_mod, j: 1.6, rho: 2.1e-8, L: 20, Asel: 0 });
    // source fault level: the grid, or for an islanded plant the converters (≈ 1.2 × rated current of PV, wind and battery inverters)
    const SscSrc = b.gridMW > 0 && b.Ssc > 0 ? b.Ssc : 1.2 * (b.pvMWp / 1.25 + b.windMW + b.batMW);
    const scT = R('DM-5.4', { Ssc: SscSrc || 1, V: b.mvKV, ST, Vs: VLL / 1000, uk: 0.08, Smax: P * 1.2, c: 1.1 });
    const I1 = ST * 1e6 / (Math.sqrt(3) * VLL);
    // harmonics: 12-pulse thyristor rectifiers (DM 5.2) with 11th/13th filters; IGBT active front-ends ≈ 4 % current distortion
    const harm = thyristor ? Object.assign(R('DM-5.2', { I1, p: 12, kov: 0.8 }), { type: '12-pulse' }) : { type: 'IGBT', THD: 0.04, h1: null, Ih1: null, Ih2: null };
    let filtTHD = harm.THD;
    if (thyristor) { let s2 = 0; for (let n = 1; n <= 4; n++) for (const sg of [-1, 1]) { const h = n * 12 + sg, a = h <= 13 ? 0.2 : 1; s2 += Math.pow(a * 0.8 / h, 2); } filtTHD = Math.sqrt(s2); }
    const Pac_mod = PDC_mod / (thyristor ? 0.98 : 0.975) / 0.99;
    const Qvar = thyristor ? Pac_mod / 1000 * Math.tan(Math.acos(cosphi)) * nMod : 0;
    const auxMW = P * b.auxFrac;
    const Saux = stdMVA(auxMW / 0.9 * 1.2);
    // power quality at the point of common coupling (IEEE 519-2022, IEC/TR 61000-3-6) for grid-connected plants
    let pq = null;
    if (b.gridMW > 0 && b.Ssc > 0) {
      const SeL = nMod * Pac_mod / 1000 / cosphi, SL = SeL + auxMW / 0.9, ratio = b.Ssc / SL;
      const TDD = 100 * filtTHD * SeL / SL, lim = H2.ieee519TDD(ratio);
      const THDv = thyristor ? 100 * 0.8 * Math.sqrt(2 * 0.04 + 6) * SeL / b.Ssc : null;   // V_h ≈ h·I_h/I_sc, filtered 11th/13th
      pq = { SL, ratio, TDD, lim, THDv, limV: H2.ieee519THDv(b.mvKV), type: thyristor ? '12-pulse thyristor with 11th/13th filters' : 'IGBT active front-end' };
    }
    const nInv = b.pvMWp > 0 ? R('DM-3.4', { P: b.pvMWp, Pm: 620, Voc: 50.5, beta: -0.0025, Tmin: 2, Vmax: 1500, r: 1.25, S: 4.2, amod: 4.65, GCR: 0.36, finfra: 0.15 }).Ninv : 0;
    const pvFeeders = Math.max(1, Math.ceil(b.pvMWp / 40));
    const turbine = b.windMW > 0 && H2.libDefault ? (CM.wind || H2.libDefault('wind', { vmean: b.vmean })) : null;
    const nWT = b.windMW > 0 ? Math.max(1, Math.round(b.windMW / (ov.wind ? ov.wind.unitMW : turbine && turbine.p ? turbine.p.unitMW : 5))) : 0;
    const elec = {
      kV: b.mvKV, islanded: isl, ppa: !isl, grid: b.gridMW > 0 ? { MW: b.gridMW, Ssc: b.Ssc, Isc: b.Ssc / (Math.sqrt(3) * b.mvKV), CI: b.gridCI } : null,
      pv: b.pvMWp > 0 ? { MWp: b.pvMWp, MWac: b.pvMWp / 1.25, inverters: nInv, feeders: pvFeeders, Sinv: 4.2, modules: d.lay.Nmod } : null,
      wind: nWT ? { MW: b.windMW, n: nWT, unit: b.windMW / nWT } : null,
      bess: b.batMW > 0 ? { MW: b.batMW, MWh: b.batMWh, Spcs: stdMVA(b.batMW / 0.95) } : null,
      aux: { MW: auxMW, S: Saux, kVsec: 0.4, comp_kW: compTrain.P, pump_kW: pumpP, water_kW: water.E_kW, fans_kW: d.dry.Pfan },
      modules: { n: nMod, ST, uk: 0.08, VLL, Vdc: V_dc, Idc: I_mod, Pdc: PDC_mod, Pac: Pac_mod, alpha: thyristor ? rectRun.alpha : null, cosphi, type: thyristor ? '12-pulse thyristor' : 'IGBT active front-end', busbar, IscT: scT.Ik, IscT_inf: scT.IscT, eta: thyristor ? 0.98 : 0.975 },
      filter: Qvar, harm, pq, SscSrc, stacksPerMod,
      totalMVA: nMod * ST + Saux
    };
    if (b.pvMWp > 0) eq('PV-001', 'PV plant' + (ov.pv ? (ov.pv.tracking > 1.18 ? ', single-axis tracking' : ', fixed tilt') : isl ? ', single-axis tracking' : '') + (isl ? '' : ' (PPA)'), 'pv', 'Power supply', [['DC capacity', b.pvMWp, 'MWp'], ['Modules (' + (ov.pv ? ov.pv.modW : 620) + ' Wp)', d.lay.Nmod, '–', 'DM 3.4'], ['Inverters (4.2 MVA)', nInv, '–', 'DM 3.4'], ['Performance ratio', d.pv.PR, '–', 'DM 3.2'], ['Specific yield', d.pv.Y, 'kWh/kWp', 'DM 3.2'], ['Energy P50 / P90', round(d.pv.E, 1) + ' / ' + round(d.pv90.P90, 1), 'GWh/a', 'DM 3.1'], ['Simulated energy (POA model)', A.E_pv_GWh, 'GWh/a', 'CM 14.1'], ['Land', d.lay.land, 'ha', 'DM 3.4']]);
    if (nWT) eq('WT-001', 'Wind farm', 'wind', 'Power supply', [turbine ? ['Turbine', turbine.name, ''] : null, ['Turbines', nWT + ' × ' + round(b.windMW / nWT, 1), 'MW'], ['Mean wind at hub', b.vmean, 'm/s'], ['Weibull shape factor k', b.windK || 2, '–'], turbine ? ['Turbine class limit (annual mean at hub)', turbine.p.iecV, 'm/s', 'IEC 61400-1'] : null, ['Weibull scale c', d.wind.c, 'm/s', 'CM 14.4'], ['Net capacity factor', d.wnet.CF, '–', 'DM 4.2'], ['Energy (Weibull)', d.wnet.E, 'GWh/a', 'DM 4.2'], ['Simulated energy (air-density corrected)', A.E_wind_GWh, 'GWh/a', 'CM 14.3']].filter(Boolean));
    if (b.batMW > 0) eq('BT-001', 'Battery energy storage (LFP)', 'battery', 'Power supply', [['Power / energy', b.batMW + ' MW / ' + b.batMWh + ' MWh', ''], ['Round-trip efficiency', ov.bat ? ov.bat.eta_rt : 0.88, '–'], ['Equivalent full cycles', A.bat_cycles, '1/a'], ['Losses', A.E_batloss_GWh, 'GWh/a'], ['Role', isl ? 'grid-forming, black start' : 'firming', ''], ['Siting', '≥ 3 m clearance to buildings, lot lines and combustibles; UL 9540 / 9540A tested units', '', 'NFPA 855 / IFC'], ['Safety standards', 'IEC 62619 cells, IEC 62933-5-2 system', '', 'IEC']]);
    const gS = annual.site;
    if (b.gridMW > 0) eq('GR-001', 'Grid connection', 'grid', 'Power supply', [['Voltage', b.mvKV, 'kV'], ['Import limit', b.gridMW, 'MW'], ['Fault level', b.Ssc, 'MVA'], ['Short-circuit current', elec.grid.Isc, 'kA', 'DM 5.4'], ['Grid energy (simulated)', A.E_grid_GWh, 'GWh/a'], A.E_export_GWh > 0 ? ['Surplus renewable energy sold', A.E_export_GWh, 'GWh/a'] : null,
      ['Grid use', b.gridMode === 'price' ? 'price-following, cap ' + b.gridPriceCap + ' EUR/MWh' : b.gridMode, ''], gS && gS.grid_price_paid != null ? ['Mean price paid for grid electricity (hourly series)', round(gS.grid_price_paid, 1), 'EUR/MWh'] : null,
      cfg.grid.CI_series && gS && gS.grid_CI_mean != null ? ['Grid carbon intensity (hourly series, import-weighted)', round(gS.grid_CI_mean, 0), 'g/kWh'] : ['Grid carbon intensity', b.gridCI, 'g/kWh'], pq ? ['Short-circuit ratio I_sc/I_L', pq.ratio, '–', 'IEEE 519'] : null].filter(Boolean));
    eq('TR-101', 'Rectifier transformers', 'transformer', 'Electrical', [['Units', nMod, '×'], ['Rating', ST, 'MVA', 'DM 5.2'], ['Voltage ratio', b.mvKV + ' kV / ' + VLL + ' V', ''], ['Impedance u_k', 8, '%'], ['Secondary fault current I″k (c = 1.1, source ' + round(SscSrc, 0) + ' MVA)', scT.Ik, 'kA', 'IEC 60909'], ['Losses', 'with the rectifier harmonic spectrum', '', 'IEC 61378-1']], { count: nMod });
    eq('RC-101', 'Rectifiers (' + elec.modules.type + ')', 'rectifier', 'Electrical', [['Units', nMod, '×'], ['DC output', round(V_dc, 0) + ' V / ' + round(I_mod / 1000, 2) + ' kA', '', 'DM 5.1'], ['DC power', PDC_mod, 'kW'], ['Firing angle', thyristor ? rectRun.alpha : '– (PWM)', thyristor ? '°' : '', 'DM 5.1'], ['Power factor', cosphi, '–', 'DM 5.2'],
      ['Characteristic harmonics', thyristor ? 'h = 11, 13 (12-pulse)' : 'switching band (kHz)', '', 'DM 5.2'], ['Current distortion (no filter)', 100 * harm.THD, '%', 'DM 5.2'], ['DC busbar (1.6 A/mm²)', busbar.Areq, 'mm²', 'DM 5.3'], ['Busbar loss (20 m loop)', busbar.P, 'kW', 'DM 5.3']], { count: nMod });
    if (thyristor) eq('FC-101', 'Harmonic filters / STATCOM', 'filter', 'Electrical', [['Reactive power', Qvar, 'Mvar', 'DM 5.2'], ['Filter tuning', '11th / 13th', ''], ['Residual current distortion', 100 * filtTHD, '%', 'IEEE 519']]);
    eq('TX-401', 'Auxiliary transformer', 'transformer', 'Electrical', [['Rating', Saux, 'MVA'], ['Voltage', b.mvKV + ' kV / 0.4 kV', ''], ['Auxiliary load', auxMW, 'MW']]);

    /* ---------------- energy streams (design point) ---------------- */
    const estreams = [
      { no: 'E1', name: 'Electrolyser AC input', from: 'MV bus', to: 'TR-101', kW: Pac_mod * nMod },
      { no: 'E2', name: 'DC power to stacks', from: 'RC-101', to: 'EL-101', kW: PDC_mod * nMod },
      { no: 'E3', name: isSOEC ? 'Stack heat demand (supplied)' : 'Stack heat to coolant', from: isSOEC ? 'E-103' : 'EL-101', to: isSOEC ? 'EL-101' : 'E-101', kW: isSOEC ? d.heat.Qin * 1000 : Qst_kW },
      { no: 'E4', name: 'Compressor shaft power', from: 'TX-401', to: 'CP-201', kW: compTrain.P },
      { no: 'E5', name: 'Heat rejected to air', from: 'CL-401', to: 'ambient', kW: d.Qtot * 1000 },
      { no: 'E6', name: 'Hydrogen chemical energy (LHV)', from: 'D-101', to: 'CP-201', kW: mProd * C.LHV }];
    if (isSOEC) estreams.push({ no: 'E7', name: 'Heat for steam raising', from: b.soecHeat === 'external' ? 'external heat' : 'MV bus', to: 'E-103', kW: 6.6 * mStack });

    /* ---------------- annual Sankey data ---------------- */
    const sk = []; const add = (a, bb, v, t) => { if (v > 1e-6) sk.push({ s: a, t: bb, v, type: t }); };
    add('PV', 'Electrical bus', A.E_pv_GWh, 'elec'); add('Wind', 'Electrical bus', A.E_wind_GWh, 'elec'); add('Grid', 'Electrical bus', A.E_grid_GWh, 'elec');
    add('Electrical bus', 'Curtailed', A.E_curt_GWh, 'loss'); add('Electrical bus', 'Exported (PPA surplus)', A.E_export_GWh, 'elec'); add('Electrical bus', 'Auxiliaries', A.E_aux_GWh + A.E_standby_GWh, 'aux');
    add('Electrical bus', 'Battery losses', A.E_batloss_GWh + Math.max(0, A.E_bat_delta_GWh), 'loss'); add('Electrical bus', 'Electrolyser input', A.E_ely_GWh, 'elec');
    add('Electrolyser input', 'Conversion losses', A.E_conv_GWh, 'loss'); add('Electrolyser input', 'Electrolyser BoP', A.E_bop_GWh, 'aux'); add('Electrolyser input', 'Heat supply', A.E_heat_el_GWh, 'heat'); add('Electrolyser input', 'Stack DC', A.E_dc_GWh, 'elec');
    add('External heat', 'Heat supply', A.E_heat_ext_GWh, 'heat');
    const Hs = A.E_H2_stack_LHV_GWh, Hp = A.E_H2_LHV_GWh, purL = Hs - Hp;   // hydrogen from the stacks, product after gas processing, loss (LHV)
    if (isSOEC) {   // steam electrolysis: DC energy and supplied heat become chemical energy; the rest leaves as heat
      const heatIn = A.E_heat_el_GWh + A.E_heat_ext_GWh, dcH = Math.min(A.E_dc_GWh, Hp), htH = Hp - dcH, dcP = Math.min(A.E_dc_GWh - dcH, purL), htP = purL - dcP;
      add('Stack DC', 'Hydrogen (LHV)', dcH, 'h2'); add('Heat supply', 'Hydrogen (LHV)', htH, 'heat'); add('Stack DC', 'Gas-processing losses', dcP, 'loss'); add('Heat supply', 'Gas-processing losses', htP, 'loss');
      add('Stack DC', 'Stack and steam heat', A.E_dc_GWh - dcH - dcP, 'heat'); add('Heat supply', 'Stack and steam heat', heatIn - htH - htP, 'heat');
    } else {        // liquid water: HHV − LHV is the latent heat of the product water, the rest is stack heat to the coolant
      add('Stack DC', 'Stack heat', Math.max(0, A.E_dc_GWh - A.E_H2_stack_HHV_GWh), 'heat'); add('Stack DC', 'Latent heat', A.E_H2_stack_HHV_GWh - Hs, 'loss');
      add('Stack DC', 'Hydrogen (LHV)', Hp, 'h2'); add('Stack DC', 'Gas-processing losses', purL, 'loss');
    }
    if (nh3) { const nh3E = A.H2_t * nh3Y / H2.NH3.h2 * 5.17 / 1000; add('Hydrogen (LHV)', 'Ammonia (LHV)', nh3E, 'nh3'); add('Hydrogen (LHV)', 'Synthesis losses', A.E_H2_LHV_GWh - nh3E, 'loss'); }
    const sankeyE = { unit: 'GWh/a', links: sk, closure: (A.E_pv_GWh + A.E_wind_GWh + A.E_grid_GWh) - (A.E_curt_GWh + A.E_export_GWh + A.E_aux_GWh + A.E_standby_GWh + A.E_batloss_GWh + A.E_bat_delta_GWh + A.E_ely_GWh) };
    const mH2a = A.H2_t / 1000, mH2s = A.H2_stack_t / 1000, DIa = A.V_DI_m3a / 1000, rawA = A.V_raw_m3a / 1000 * rhoRaw / 1000; // kt/a
    const stoich = C.w_H2O * mH2s;
    const mk = []; const addm = (a, bb, v, t) => { if (v > 1e-9) mk.push({ s: a, t: bb, v, type: t }); };
    addm('Raw water', 'Demineralised water', DIa, 'water'); addm('Raw water', 'Brine / reject', rawA - DIa, 'water');
    addm('Demineralised water', 'Electrolysis', stoich, 'water'); addm('Demineralised water', 'Losses & blowdown', Math.max(0, DIa - stoich), 'loss');
    addm('Electrolysis', 'Hydrogen', mH2a, 'h2'); addm('Electrolysis', 'Gas-processing losses', mH2s - mH2a, 'loss'); addm('Electrolysis', 'Oxygen', C.w_O2 * mH2s, 'o2');
    if (nh3) { const nh3a = mH2a * nh3Y / H2.NH3.h2; addm('Air (N₂)', 'Ammonia', (1 - H2.NH3.h2) * nh3a, 'n2'); addm('Hydrogen', 'Ammonia', mH2a * nh3Y, 'h2'); addm('Hydrogen', 'Purge losses', mH2a * (1 - nh3Y), 'loss'); }
    const sankeyM = { unit: 'kt/a', links: mk };

    /* ---------------- plot plan (to scale, metres) ---------------- */
    const hallA = P * ({ AEL: 60, PEM: 40, AEM: 50, SOEC: 70 }[tech] || 60);
    const TAGS = { SS: 'Substation', RC: 'TR/RC-101', EL: 'EL-101', GP: 'GP-101', WT: 'WT-101', CL: 'CL-401', CR: 'Control', BT: 'BT-001', CP: 'CP-201', ST: 'ST-201', NH: 'NH-301', AS: 'AS-301', TK: 'TK-301', HR: 'HR-301', PL: 'PL-301', TL: 'TL-301' };
    const box = (id, name, area, aspect, kind) => { const w = Math.sqrt(area * aspect); return { id, tag: TAGS[id] || id, name, w: Math.max(6, w), h: Math.max(5, area / w), kind }; };
    const blocks = [];
    blocks.push(box('SS', 'Substation ' + b.mvKV + ' kV', Math.max(300, P * 8), 1.3, 'elec'));
    blocks.push(box('RC', 'Transformers & rectifiers', Math.max(120, P * 12), 2.5, 'elec'));
    blocks.push(box('EL', 'Electrolyser hall EL-101', Math.max(150, hallA), 2.5, 'process'));
    blocks.push(box('GP', 'Gas processing GP-101', Math.max(80, nGP * 140), 1.6, 'process'));
    blocks.push(box('WT', 'Water plant WT-101', Math.max(150, raw_m3h * 24 * 0.6), 1.5, 'water'));
    blocks.push(box('CL', 'Dry coolers CL-401', Math.max(60, d.Qtot * 35), 3, 'util'));
    blocks.push(box('CR', 'Control & admin', Math.max(250, 300 + P * 2), 1.6, 'bldg'));
    if (b.batMWh > 0) blocks.push(box('BT', 'Battery BT-001', Math.max(200, b.batMWh * 20), 2.5, 'elec'));
    const hazard = [box('CP', 'Compressors CP-201', Math.max(80, (nComp + 1) * 90), 1.8, 'haz'), box('ST', 'Storage ST-201', Math.max(100, vol.V * (b.storeP >= 300 ? 0.6 : b.storeP >= 150 ? 0.9 : 1.0)), 2.2, 'haz')];
    const endBlocks = [];
    if (nh3) { endBlocks.push(box('NH', 'Ammonia loop NH-301', 9000, 1.5, 'nh3'), box('AS', 'ASU AS-301', 2500, 1.6, 'nh3'), box('TK', 'NH₃ tank TK-301', Math.pow(Math.sqrt(endUse.tankV / 25 * 4 / Math.PI) + 8, 2), 1, 'nh3')); }
    else if (b.deliver === 'hrs') endBlocks.push(box('HR', 'Refuelling station HR-301', 1200, 1.4, 'haz'));
    else { if (b.deliver === 'pipeline' && b.pipeKm > 0) endBlocks.push(box('PL', 'Pipeline station PL-301', 150, 1.5, 'haz')); if (b.trailer_kgd > 0) endBlocks.push(box('TL', 'Trailer bay TL-301', 800, 2, 'haz')); }
    // safety distances around storage (CM 19) and the code distances of NFPA 2
    const rel = R('CM-19.1', { d: 3, p: b.storeP, T: 20, Cd: 0.85 });
    const jet = R('CM-19.5', { d: 3, rho0: rel.rho0, m: rel.m / 1000 });
    const rad = R('CM-19.6', { chi: 0.1, tau: 0.8, m: rel.m / 1000, q: 4.7 });
    const radC = jet.Lf / 2 + rad.r;                     // radiation measured from the leak: point source at the flame centre
    const blastM = Math.min(vol.mtot, H2.BLAST_MASS_MAX);
    const blast = R('CM-19.8', { m: blastM, ey: 0.1, R: 30, dp: 10 });
    const nfpa = H2.nfpa2Distances(b.storeP);
    const sepReq = Math.max(jet.xLFL, radC, nfpa.g1);  // to buildings, air intakes and ignition sources of the process area
    const sepDist = Math.max(sepReq, 8);
    // placement: process row, utility row, hazardous yard to the east beyond the separation distance
    const road = 12; let x = 0; const row1 = [], row2 = [];
    ['SS', 'RC', 'EL', 'GP'].forEach(id => { const bl = blocks.find(q => q.id === id); bl.x = x; bl.y = 0; x += bl.w + road; row1.push(bl); });
    const h1 = Math.max(...row1.map(q => q.h));
    x = 0; ['CR', 'WT', 'CL', 'BT'].forEach(id => { const bl = blocks.find(q => q.id === id); if (!bl) return; bl.x = x; bl.y = h1 + road; x += bl.w + road; row2.push(bl); });
    const procW = Math.max(...blocks.map(q => q.x + q.w)), procH = Math.max(...blocks.map(q => q.y + q.h));
    let hx = procW + Math.max(road, sepDist); let hy = 0;
    hazard.forEach(bl => { bl.x = hx; bl.y = hy; hy += bl.h + road; });
    const hazW = Math.max(...hazard.map(q => q.w));
    let ex = hx + hazW + Math.max(road, sepDist * 0.6), ey = 0;
    endBlocks.forEach(bl => { bl.x = ex; bl.y = ey; ey += bl.h + road; });
    const all = blocks.concat(hazard, endBlocks);
    const siteW = Math.max(...all.map(q => q.x + q.w)) + 2 * road, siteH = Math.max(...all.map(q => q.y + q.h)) + 2 * road;
    const stB = hazard[1];
    // provided distances measured on the plan: storage yard to the process area and to the fence (blocks sit one road width inside the fence)
    const gapProc = stB.x - procW;
    const gapFence = Math.min(stB.y + road, stB.x + road, siteW - (stB.x + road + stB.w), siteH - (stB.y + road + stB.h));
    const layout = { blocks: all, siteW, siteH, road, circles: [
      { cx: stB.x + stB.w / 2, cy: stB.y + stB.h / 2, r: stB.w / 2 + jet.xLFL, label: 'LFL, 3 mm leak (CM 19.5)', kind: 'lfl', value: jet.xLFL },
      { cx: stB.x + stB.w / 2, cy: stB.y + stB.h / 2, r: stB.w / 2 + radC, label: '4.7 kW/m² from the leak (CM 19.5/19.6)', kind: 'rad', value: radC },
      { cx: stB.x + stB.w / 2, cy: stB.y + stB.h / 2, r: blast.Rdp, label: '10 kPa, ' + Math.round(blastM) + ' kg cloud (CM 19.8)', kind: 'blast', value: blast.Rdp }],
      rel, jet, rad, radC, blast, nfpa, sepDist, sepReq, gapProc, gapFence, offsite: { pvHa: d.lay.land, windN: nWT } };

    /* ---------------- hazardous areas (IEC 60079-10-1 screening) ---------------- */
    // extent of a zone 2 from a secondary-grade release (0.25 mm² hole, d ≈ 0.56 mm) at the operating pressure: distance to the LFL, at least 1 m
    const zoneExt = p => { if (!(p > 1.5)) return 1; const r0 = R('CM-19.1', { d: 0.564, p, T: 20, Cd: 0.85 }), j0 = R('CM-19.5', { d: 0.564, rho0: r0.rho0, m: r0.m / 1000 }); return Math.max(1, Math.ceil(j0.xLFL * 2) / 2); };
    const hz = [];
    const addHz = (area, tag, src, p, zone, group, extra) => hz.push(Object.assign({ area, tag, src, grade: zone === 'Zone 1' ? 'primary' : 'secondary', zone, ext: zone === 'Zone 1' ? null : zoneExt(p), p, group: group || 'IIC', tclass: 'T1', epl: zone === 'Zone 1' ? 'Gb (ATEX 2G)' : 'Gc (ATEX 3G)' }, extra || {}));
    addHz('Electrolyser hall', 'EL-101', 'flanges, valves and seals of stacks and separators (ventilated hall, DM 11.2)', pH2, 'Zone 2');
    addHz('Gas processing', 'GP-101', 'flanges, valves, instrument connections', pH2, 'Zone 2');
    if (stages.length) addHz('Compressor area', 'CP-201', 'packings, distance-piece vents, flanges', b.storeP, 'Zone 2');
    addHz('Storage yard', 'ST-201', 'flanges, valves, relief-valve outlets', b.storeP, 'Zone 2');
    addHz('Hydrogen vent stack outlet', 'VS-401', 'venting and relief (primary grade) – extent by dispersion analysis (EIGA Doc 211)', 1.1, 'Zone 1');
    if (nh3) addHz('Ammonia loop and tank', 'NH-301 / TK-301', 'flanges, valves (NH₃, LFL 15 vol-%)', 150, 'Zone 2', 'IIA', { ext: 'by calculation (NH₃)' });
    if (b.deliver === 'hrs' && !nh3) addHz('Refuelling station', 'HR-301', 'dispenser, nozzle, booster and cascade (ISO 19880-1)', 900, 'Zone 2');
    if (endUse.pipe) addHz('Pipeline station', 'PL-301', 'flanges, pig traps, metering', b.pipeP + 2, 'Zone 2');
    if (endUse.trailer) addHz('Trailer bay', 'TL-301', 'filling couplings and hoses', 500, 'Zone 2');

    /* ---------------- major-accident regulations (Seveso III, OSHA PSM, EPA RMP) ---------------- */
    const trailerKg = d.tr ? d.tr.N * 1100 : 0, cascKg = endUse.hrs ? endUse.hrs.casc : 0, procKg = mStack * 5 / 60;   // trailers on site, HRS cascade, process holdup ≈ 5 min of production
    const h2inv_t = (invCold + trailerKg + cascKg + procKg) / 1000, nh3inv_t = endUse.tankT || 0;
    const seveso = Object.assign(H2.majorAccident({ hydrogen: h2inv_t, ammonia: nh3inv_t }), { h2_t: h2inv_t, nh3_t: nh3inv_t, parts: { storage: invCold, trailers: trailerKg, cascade: cascKg, process: procKg }, Tmin });

    /* ---------------- design checks ---------------- */
    const chk = (group, name, value, limit, ok, ref, unit) => checks.push({ group, name, value, limit, ok, ref, unit: unit || '' });
    chk('Electrolysis', 'H₂ in O₂ at the operating minimum load', 100 * d.minL.xH2inO2, '≤ ' + 100 * alarm.trip + ' % (trip)', d.minL.xH2inO2 <= alarm.trip + 1e-9, 'CM 7.7 / ISO 22734-1', '%');
    chk('Sizing', 'Electrolyser capacity vs sizing chain (±10 %)', P, '≥ ' + (0.9 * d.chain.Pely).toFixed(1) + ' MW', P >= d.chain.Pely * 0.9, 'DM 1.2', 'MW');
    const need = nh3 ? b.demand * H2.NH3.h2 / nh3Y : b.demand * 0.365;
    chk('Sizing', 'Annual hydrogen after gas processing (simulated) vs demand', A.H2_t, '≥ ' + (0.97 * need).toFixed(0) + ' t/a (97 % of ' + need.toFixed(0) + ')', A.H2_t >= need * 0.97, 'DM 1.1 / CM 1.4', 't/a');
    chk('Environment', 'GHG intensity, hourly correlation (RFNBO, binding from 2030)', A.CI_kgkg, '≤ 3.38 kg/kg', A.CI_kgkg <= 3.38, '2023/1184, 2023/1185', 'kg/kg');
    if (A.CI_monthly != null) chk('Environment', 'GHG intensity, monthly correlation (RFNBO, until end of 2029)', A.CI_monthly, '≤ 3.38 kg/kg', A.CI_monthly <= 3.38, '2023/1184 Art. 6', 'kg/kg');
    if (T2c != null) chk('Compression', 'Stage discharge temperature', T2c, '≤ ' + Tlim + ' °C (API 618, 6th ed.)', T2c <= Tlim + 0.5, 'DM 12.1 / API 618', '°C');
    chk('Cooling', 'Dry-cooler approach at design ambient', coolLoop.Tsup - Tamb, '≥ 10 K', coolLoop.Tsup - Tamb >= 10, 'DM 9.3', 'K');
    if (endUse.pipe) {
      chk('Transport', 'Pipeline wall thickness', endUse.pipe.wall.tSel, '≥ max(B31.12 + 1 mm, 6.4 mm)', endUse.pipe.wall.tSel >= Math.max(endUse.pipe.wall.tReq, 6.4) - 1e-9, 'ASME B31.12 / EIGA Doc 121', 'mm');
      chk('Transport', 'Pipeline hoop stress at operating pressure', 100 * endUse.pipe.wall.hoopFrac, '≤ 30 % SMYS', endUse.pipe.wall.hoopFrac <= 0.3, 'EIGA Doc 121', '%');
      chk('Transport', 'Pipeline velocity (economic guidance)', endUse.pipe.u, '≤ 15–20 m/s', endUse.pipe.u <= 20, 'DM 14.2', 'm/s');
    }
    if (hrsChk) {
      chk('Refuelling', 'Fuel delivery temperature window (T40)', hrsChk.Tout, '−40 to −33 °C', hrsChk.Tout >= -40 && hrsChk.Tout <= -33, 'SAE J2601', '°C');
      chk('Refuelling', 'Hot-fill end pressure at 85 °C', hrsChk.pEnd, '≤ ' + hrsChk.MOP + ' bar (MOP, H70)', hrsChk.pEnd <= hrsChk.MOP, 'SAE J2601 / DM 16.3', 'bar');
      chk('Refuelling', 'Cascade pressure above the vehicle MOP', hrsChk.casc, '> ' + hrsChk.MOP + ' bar', hrsChk.casc > hrsChk.MOP, 'ISO 19880-1', 'bar');
      chk('Refuelling', 'Hydrogen fuel quality (grade D): total impurities', imp.O2 + imp.H2O + imp.N2, '≤ 300 µmol/mol; H₂O ≤ 5, O₂ ≤ 5', purity >= H2.ISO14687_D.H2 && imp.H2O <= H2.ISO14687_D.H2O && imp.O2 <= H2.ISO14687_D.O2 && imp.N2 <= H2.ISO14687_D.N2, 'ISO 14687:2025', 'µmol/mol');
    }
    if (gyp.valid) chk('Water', 'Gypsum saturation of concentrate', gyp.S, '≤ 1 (else antiscalant)', gyp.S <= 1, 'DM 8.7', '–');
    if (diffuser) chk('Water', 'Brine diffuser dilution (≤ +1.5 g/L at the edge of the mixing zone)', diffuser.Sr, '≥ ' + diffuser.Sreq.toFixed(0), diffuser.ok === 1, 'DM 8.8', '–');
    chk('Power', 'Unserved auxiliary energy', A.unmet_MWh, '= 0 MWh', A.unmet_MWh < 1, 'DM 4.3', 'MWh/a');
    chk('Power', 'Energy balance closure', Math.abs(sankeyE.closure), '< 0.01 GWh', Math.abs(sankeyE.closure) < 0.01, 'solver', 'GWh');
    // measured site data (Hasim 3.0): the weather year must be mostly measured, not filled (Muhsen 2026 §13.6)
    const mW = H2.siteWeather ? H2.siteWeather(b) : null;
    if (mW && mW.qc) { const cov = ['ghi', 'tam', 'ws'].map(k => mW.qc.coverage[k] == null ? 1 : mW.qc.coverage[k]); chk('Site', 'Measured weather: data coverage before gap filling', 100 * Math.min.apply(null, cov), '≥ 90 %', Math.min.apply(null, cov) >= 0.9, 'Muhsen (2026) §13.6', '%'); }
    if (pq) {
      chk('Power', 'Harmonic current distortion TDD at the PCC', pq.TDD, '≤ ' + pq.lim + ' % (I_sc/I_L = ' + pq.ratio.toFixed(0) + ')', pq.TDD <= pq.lim, 'IEEE 519-2022', '%');
      if (pq.THDv != null) chk('Power', 'Voltage distortion THD at the PCC', pq.THDv, '≤ ' + pq.limV + ' %', pq.THDv <= pq.limV, 'IEEE 519-2022 / IEC 61000-3-6', '%');
    }
    if (turbine && turbine.p) chk('Power', 'Site wind within the turbine class (' + turbine.name.replace(/.*\((IEC [^)]*)\).*/, '$1') + ')', b.vmean, '≤ ' + turbine.p.iecV + ' m/s', b.vmean <= turbine.p.iecV + 1e-9, 'IEC 61400-1', 'm/s');
    chk('Safety', 'Storage separation to the process area', gapProc, '≥ ' + sepReq.toFixed(1) + ' m (LFL, 4.7 kW/m², NFPA 2 group 1)', gapProc >= sepReq - 1e-6, 'CM 19 / NFPA 2', 'm');
    chk('Safety', 'Storage distance to the site boundary', gapFence, '≥ ' + nfpa.g1 + ' m (NFPA 2 group 1, lot line)', gapFence >= nfpa.g1 - 1e-6, 'NFPA 2 (2026)', 'm');
    if (H2.plantComponentChecks) H2.plantComponentChecks(b, { endUse, annual }).forEach(c => checks.push(c));
    // library components on the datasheets
    const LBL = { stack: 'EL-101', psu: 'RC-101', bop: 'EL-101', pv: 'PV-001', wind: 'WT-001', battery: 'BT-001', water: 'WT-101', compressor: 'CP-201', storage: 'ST-201', pipeline: 'PL-301', trailer: 'TL-301', hrs: 'HR-301', ammonia: 'NH-301' };
    ['ammonia', 'hrs', 'trailer', 'pipeline', 'storage', 'compressor', 'water', 'battery', 'wind', 'pv', 'bop', 'psu', 'stack'].forEach(slot => { const e = E[LBL[slot]]; if (e && CM[slot] && CM[slot].name) e.props.unshift([slot === 'bop' ? 'Balance of plant (library)' : slot === 'psu' ? 'Power electronics (library)' : 'Library component', CM[slot].name, '']); });

    /* ---------------- codes, standards and regulations (screening tables) ---------------- */
    const fx = (v, n) => (typeof v === 'number' && isFinite(v) ? v.toFixed(n == null ? 1 : n) : String(v));
    const siteS = annual.site || null;   // hourly-series results of the dispatch (Hasim 3.0)
    const compliance = [
      { id: 'rfnbo', title: 'EU renewable hydrogen (RFNBO) – Delegated Regulations (EU) 2023/1184 and 2023/1185', head: ['Criterion', 'Result', 'Note'], rows: [
        ['GHG intensity, hourly correlation', fx(A.CI_kgkg, 2) + ' kg CO₂e/kg', 'threshold 3.38 kg/kg (70 % saving against 94 g CO₂e/MJ); grid at ' + (siteS && siteS.grid_CI_mean != null && cfg.grid.CI_series ? 'the hourly carbon intensity of the series (' + fx(siteS.grid_CI_mean, 0) + ' g/kWh weighted mean)' : b.gridCI + ' g/kWh') + ', renewable electricity at zero, no equipment emissions'],
        ['GHG intensity, monthly correlation', A.CI_monthly != null ? fx(A.CI_monthly, 2) + ' kg CO₂e/kg' : 'not applicable', A.CI_monthly != null ? 'grid imports matched by PPA surplus sold in the same month (allowed until 31 Dec 2029)' : 'surplus renewable energy is curtailed, so no grid import can be matched'],
        ['Additionality, geographic correlation', 'not assessed', 'renewable plants not older than 36 months, same or interconnected bidding zone (2023/1184 Art. 5, 7) – check the PPA'],
        ['Grid electricity counted as renewable', siteS && siteS.lowprice_hours != null ? fx(siteS.grid_lowprice_GWh, 2) + ' GWh in ' + siteS.lowprice_hours + ' low-price hours' : 'not assessed',
          siteS && siteS.lowprice_hours != null ? 'hours with a day-ahead price ≤ ' + fx(siteS.lowprice_threshold, 1) + ' EUR/MWh (20 EUR/MWh or 0.36 × ETS ' + fx(b.etsPrice, 0) + ' EUR/t) count as renewable (2023/1184 Art. 4(3)); without the rule ' + fx(siteS.CI_nolowprice, 2) + ' kg/kg. Bidding zone > 90 % renewable or < 18 g CO₂e/MJ with a PPA (Art. 4(1), (2)) not assessed' : 'bidding zone > 90 % renewable, or < 18 g CO₂e/MJ with a PPA, or low-price hours (2023/1184 Art. 4) – import an hourly price series to assess the low-price rule'],
        ['Transport, conversion, end use', nh3 ? 'hydrogen at the plant gate' : 'plant gate', nh3 ? 'the RFNBO value of ammonia must add synthesis, transport and cracking emissions' : 'add distribution emissions for the delivered fuel']] },
      { id: 'haz', title: 'Hazardous areas – IEC 60079-10-1:2020 (screening), ATEX 1999/92/EC', head: ['Area', 'Source of release', 'Grade', 'Zone', 'Extent', 'Gas group / T class', 'EPL / ATEX'],
        rows: hz.map(z => [z.area + ' (' + z.tag + ')', z.src, z.grade, z.zone, typeof z.ext === 'number' ? z.ext.toFixed(1) + ' m' : (z.ext || 'by dispersion analysis'), z.group + ' / ' + z.tclass, z.epl]),
        note: 'Zone 2 extents: distance to the LFL of a 0.25 mm² secondary release at the operating pressure (CM 19.1/19.5), at least 1 m; hydrogen IIC T1 (auto-ignition 560 °C), ammonia IIA T1. Confirm with the dilution assessment of IEC 60079-10-1 Annex C/D.' },
      { id: 'seveso', title: 'Major-accident regulations – Seveso III (2012/18/EU), OSHA PSM (29 CFR 1910.119), EPA RMP (40 CFR 68)', head: ['Item', 'Quantity', 'Classification'], rows: [
        ['Hydrogen: storage at ' + fx(Math.min(Tmin, 25), 0) + ' °C, trailers, HRS cascade, process holdup', fx(h2inv_t, 2) + ' t', seveso.items.find(i => i.substance === 'hydrogen') ? seveso.items.find(i => i.substance === 'hydrogen').tier + ' (5 t / 50 t)' : 'below threshold'],
        nh3 ? ['Ammonia (anhydrous), 30-day tank', fx(nh3inv_t, 0) + ' t', seveso.items.find(i => i.substance === 'ammonia').tier + ' (50 t / 200 t)'] : null,
        ['Summation rule (Annex I, note 4)', 'Σ q/Q_lower ' + fx(seveso.sumL, 2) + ', Σ q/Q_upper ' + fx(seveso.sumU, 2), 'establishment: ' + seveso.tier],
        ['OSHA PSM / EPA RMP (10 000 lb = 4.5 t)', fx(h2inv_t, 1) + ' t H₂' + (nh3 ? ', ' + fx(nh3inv_t, 0) + ' t NH₃' : ''), seveso.psm ? 'PSM and RMP apply' : 'below the threshold quantities']].filter(Boolean) },
      { id: 'press', title: 'Pressure equipment and pipelines – PED 2014/68/EU, ASME VIII, ASME B31.12, EIGA Doc 121', head: ['Item', 'Result', 'Rule'], rows: [
        ['ST-201 storage, ' + vesselVol + ' m³ at ' + b.storeP + ' bar', 'PED category ' + H2.pedCategory(b.storeP * 1.1, vesselVol * 1000) + ', wall ' + fx(vessel.tDiv1, 1) + ' mm', vessel.rule + (vessel.valid1 ? '' : ' – P > 0.385·S·E')],
        endUse.pipe ? ['PL-301 DN' + endUse.pipe.DN + ', ' + b.pipeKm + ' km', 'wall ' + fx(endUse.pipe.wall.tSel, 1) + ' mm, hoop stress ' + fx(100 * endUse.pipe.wall.hoopFrac, 1) + ' % SMYS', 'B31.12 option A (F 0.5, H_f ' + fx(endUse.pipe.wall.Hf, 3) + '), min. 6.4 mm, ≤ 30 % SMYS'] : null,
        ['CP-201 compressor', T2c == null ? 'no compression' : cN + ' stages, T₂ ' + fx(T2c, 0) + ' °C', 'API 618 limit ' + Tlim + ' °C (hydrogen-rich gas, non-lubricated)']].filter(Boolean) },
      { id: 'dist', title: 'Separation distances – NFPA 2 (2026) Table 7.3.2.3.1.1(a), bulk gaseous hydrogen', head: ['Exposure', 'Code distance', 'Provided / consequence distance'], rows: [
        ['Group 1: lot lines, air intakes, openings, ignition sources (' + nfpa.band + ')', nfpa.g1 + ' m', 'fence ' + fx(gapFence, 1) + ' m, process area ' + fx(gapProc, 1) + ' m'],
        ['Group 2: exposed persons, parked cars, combustible buildings', nfpa.g2 + ' m', 'LFL ' + fx(jet.xLFL, 1) + ' m, 4.7 kW/m² ' + fx(radC, 1) + ' m (3 mm leak)'],
        ['Group 3: non-combustible buildings, flammable-gas storage, utilities', nfpa.g3 + ' m', '10 kPa overpressure ' + fx(blast.Rdp, 0) + ' m (' + Math.round(blastM) + ' kg cloud)']],
        note: 'Code distances are screening values of the default pipe size – verify against the edition in force and the local code; the consequence distances are more conservative and support the QRA (DM 18).' },
      pq || b.batMW > 0 ? { id: 'elec', title: 'Power quality and electrical equipment – IEEE 519-2022, IEC 60909, IEC 61400-1, NFPA 855', head: ['Item', 'Result', 'Limit / rule'], rows: [
        pq ? ['Current distortion TDD at the PCC (' + pq.type + ')', fx(pq.TDD, 1) + ' %', '≤ ' + pq.lim + ' % at I_sc/I_L = ' + fx(pq.ratio, 0)] : null,
        pq && pq.THDv != null ? ['Voltage distortion THD at the PCC', fx(pq.THDv, 1) + ' %', '≤ ' + pq.limV + ' % at ' + b.mvKV + ' kV'] : null,
        ['Rectifier-transformer secondary fault current I″k', fx(scT.Ik, 0) + ' kA', 'IEC 60909, c = 1.1, source ' + fx(SscSrc, 0) + ' MVA'],
        turbine && turbine.p ? ['Wind turbine class', turbine.name.replace(/.*\((IEC [^)]*)\).*/, '$1'), 'site mean ' + b.vmean + ' m/s ≤ ' + turbine.p.iecV + ' m/s; check V_ref and turbulence class'] : null,
        b.batMW > 0 ? ['Battery BT-001 ' + b.batMW + ' MW / ' + b.batMWh + ' MWh', 'separate block on LAY-001', '≥ 3 m clearance, UL 9540A-tested units (NFPA 855 / IFC)'] : null].filter(Boolean) } : null
    ].filter(Boolean);

    equip.forEach(e => e.warn.forEach(w => msgs.push({ level: 'warn', tag: e.tag, text: w })));
    checks.filter(c => !c.ok).forEach(c => msgs.push({ level: 'warn', tag: c.group, text: c.name + ': ' + (typeof c.value === 'number' ? c.value.toFixed(2) : c.value) + ' ' + c.unit + ' (limit ' + c.limit + ', ' + c.ref + ')' }));
    const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    msgs.unshift({ level: 'ok', tag: 'Solver', text: 'System solved: ' + equip.length + ' equipment items, ' + S.length + ' streams, 8760-h dispatch' + (mW ? ' on the measured year ' + mW.label + ' (' + mW.name + ')' : '') + ' in ' + (t1 - t0).toFixed(0) + ' ms.' });
    const policy = H2.policyEval ? H2.policyEval({ annual, cfg, basis: b }, b) : null;   // incentives and carbon pricing in the ROI (Hasim 3.0)
    return { basis: b, design, annual, cfg, equip, E, streams: S, estreams, elec, cellStack, water, compTrain, endUse, layout, sankeyE, sankeyM, checks, msgs, hazAreas: hz, seveso, purity: { H2: purity, imp }, compliance, site: H2.siteInfo ? H2.siteInfo(b) : null, policy,
      kpi: { P, mStack, mProd, H2_t: A.H2_t, CF: A.CF, FLH: A.FLH, SEC: A.SEC_avg, LCOH: A.LCOH, CAPEX: A.CAPEX_MEUR, CI: A.CI_kgkg, CI_monthly: A.CI_monthly, curt: A.curt_share, water: raw_m3h, NH3_t: nh3 ? A.H2_t * nh3Y / H2.NH3.h2 : 0, LCOH_design: design.kpi.LCOH,
        LCOH_policy: policy ? policy.LCOH_policy : A.LCOH, NPV: policy ? policy.base.NPV : null, NPV_policy: policy ? policy.policy.NPV : null },
      time_ms: t1 - t0 };
  };
})(typeof window !== 'undefined' ? window : globalThis);

;
/* Hasim – Green Hydrogen Engineering Suite. © 2026 Prof. Hani Muhsen. All rights reserved. */
/* =====================================================================
   Hasim – engine-library.js
   Component library: generic equipment with technical, economic,
   environmental and social data; mapping of components to the Model
   builder blocks and to the plant design basis; component checks and the
   impact assessment (technical, economic, environmental, social).
   Default values are typical published figures or documented Hasim
   assumptions (see H2.LIB_SOURCES) – replace them with vendor data.
   Author and owner: Prof. Hani Muhsen.
   ===================================================================== */
(function (root) {
  'use strict';
  const H2 = root.H2, own = H2.own;
  const R = (id, x) => H2.run(id, x);
  const clone = o => JSON.parse(JSON.stringify(o));
  const num = (v, d) => { const n = Number(v); return isFinite(n) ? n : d; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------------- references of the default values ---------------- */
  H2.LIB_SOURCES = {
    cm: 'Green Hydrogen Calculations Manual, Ed. 3 (CM) – cell, stack, system and cost equations used by Hasim.',
    dm: 'Green Hydrogen Plant Design Manual, Ed. 1 (DM) – plant design values used by Hasim (e.g. water-plant and storage costs, example cases).',
    rut25: 'Rutovitz J., Langdon R., Briggs C., Mey F., Dominish E., Nagrath K. (2025). Updated employment factors and occupational shares for the energy transition. Renewable and Sustainable Energy Reviews 212, 115339.',
    rut10: 'Rutovitz J., Usher J. (2010). Methodology for calculating energy sector jobs. Institute for Sustainable Futures, University of Technology Sydney – regional job multipliers (Table 5), interpolated to 2026.',
    irena17: 'IRENA (2017). Renewable energy benefits: leveraging local capacity for solar PV / for onshore wind. International Renewable Energy Agency, Abu Dhabi.',
    ganter24: 'Ganter A., Lonergan K.E., Büchi H.M., Sansavini G. (2024). Shifting to low-carbon hydrogen production supports job creation but does not guarantee a just transition. One Earth 7(11), 1981–1993.',
    lbnl22: 'Bolinger M., Bolinger G. (2022). Land requirements for utility-scale PV: an empirical update on power and energy density. Lawrence Berkeley National Laboratory / IEEE Journal of Photovoltaics.',
    nrel09: 'Denholm P., Hand M., Jackson M., Ong S. (2009). Land-use requirements of modern wind power plants in the United States. NREL/TP-6A2-45834.',
    ise22: 'Reichel C. et al. (2022). CO₂ emissions of silicon photovoltaic modules – impact of module design and production location. Fraunhofer ISE, 8th World Conference on Photovoltaic Energy Conversion (WCPEC-8).',
    pvps24: 'IEA PVPS Task 12 (2024). Fact sheet: environmental life cycle assessment of electricity from PV systems (2023 update).',
    vestas25: 'Vestas Wind Systems (2025). Life cycle assessment of electricity production from an onshore V163-4.5 MW wind plant.',
    lin24: 'Lin X. et al. (2024). Environmental impact analysis of lithium iron phosphate batteries for energy storage in China. Frontiers in Energy Research 12, 1361720.',
    wei24: 'Wei et al. (2024). Comparative life cycle analysis of electrolyzer technologies for hydrogen production: manufacturing and operations. Joule 8(12).',
    doe22: 'U.S. Department of Energy (status 2022). Technical targets for proton exchange membrane electrolysis – PGM loading 0.8 g/kW, stack 450 of 1 000 USD/kW system cost, degradation 4.8 mV/1000 h, stack life 40 000 h (+10 % voltage).',
    doeael: 'U.S. Department of Energy (2023). Technical targets for liquid alkaline electrolysis – status 2022: 1.9 V at 0.5 A/cm², degradation 3.2 mV/1000 h, stack life 60 000 h; 2026 target 80 000 h.',
    doehte: 'U.S. Department of Energy. Technical targets for high-temperature electrolysis – status: 1.28 V at 0.6 A/cm², degradation 6.4 mV/1000 h, stack life 20 000 h (industry stacks tested at INL 2020–22).',
    schefold17: 'Schefold J., Brisse A., Poepke H. (2017). 23,000 h steam electrolysis with an electrolyte supported solid oxide cell. Int. J. Hydrogen Energy 42, 13415–13426 – 7.4 mV/1000 h over 20 000 h.',
    enapter: 'Enapter AG. Data sheets EL 4.1 (4.8 kWh/Nm³ at beginning of life) and AEM Nexus 1000 (51.3 kWh/kg incl. utilities).',
    scheepers20: 'Scheepers F. et al. (2020). Improving the efficiency of PEM electrolyzers through membrane-specific pressure optimization. Energies 13, 612 – cathode pressure set as a function of current density.',
    nrelcwer24: 'Stehly T., Duffy P., Mulas Hernando D. (2024). Cost of Wind Energy Review: 2024 Edition. NREL/PR-5000-91775 – total losses 18.8 % (land-based reference, k = 2.0) and 15.5 % (fixed-bottom offshore, k = 2.1); offshore O&M 135 USD/kW-yr on 5 411 USD/kW.',
    iea15: 'Gaertner E. et al. (2020). Definition of the IEA 15-megawatt offshore reference wind turbine. NREL/TP-5000-75698 – 240 m rotor, 150 m hub, cut-in 3, rated 10.59, cut-out 25 m/s, IEC class 1B.',
    irena25: 'IRENA (2025). Renewable power generation costs in 2024 – offshore wind, global weighted-average total installed cost 2 852 USD/kW (Hasim: 2 650 EUR/kW at 1.08 USD/EUR).',
    vestas24: 'Allekotte M., Garrett P. (2024). Life cycle assessment of electricity production from an offshore V236-15.0 MW wind plant. Vestas Wind Systems – 887 t CO₂e per MW of the plant, 7.0 g CO₂e/kWh.',
    col23: 'Corbeau A.-S., Merz A.-K. (2023). Demystifying electrolyzer production costs. Center on Global Energy Policy, Columbia University – stacks are 19–60 % of electrolyser system cost.',
    wri23: 'Kuzma S. et al. (2023). Aqueduct 4.0: updated decision-relevant global water risk indicators. World Resources Institute – baseline water stress classes.',
    seveso: 'Directive 2012/18/EU (Seveso III), Annex I Part 2 – qualifying quantities: hydrogen 5 t / 50 t, ammonia (anhydrous) 50 t / 200 t (lower / upper tier).',
    who: 'UN General Assembly resolution 64/292 and WHO guidance: 50–100 litres of water per person per day meet most basic needs.',
    iec: 'IEC 61400-1: wind-turbine classes I / II / III for annual mean wind speeds at hub height of 10 / 8.5 / 7.5 m/s.',
    hasim: 'Hasim assumption – a documented screening value (User Manual, section 9.4); replace it with project or vendor data.'
  };

  /* ---------------- assessment settings ---------------- */
  // labour-productivity multipliers relative to OECD (Rutovitz & Usher 2010, Table 5, interpolated 2020 → 2030 to 2026)
  H2.REGIONS = { oecd: ['OECD', 1.0], me: ['Middle East', 2.0], latam: ['Latin America', 2.3], china: ['China', 1.3], india: ['India', 1.4], asia: ['Developing Asia', 1.5], africa: ['Africa', 6.8], trans: ['Transition economies', 1.7] };
  // WRI Aqueduct baseline water stress (withdrawals / renewable supply)
  H2.STRESS = { low: ['Low', '< 10 %', 0], lowmed: ['Low–medium', '10–20 %', 1], medhigh: ['Medium–high', '20–40 %', 2], high: ['High', '40–80 %', 3], extreme: ['Extremely high', '> 80 %', 4] };
  H2.ASSESS_DEFAULTS = { region: 'oecd', locMfg: 0, locInst: 0.9, locOther: 0.5, stress: 'medhigh', dBound: 100, dRes: 1000, h2Price: 6 };
  H2.JOBS_GENERIC = { ci: 1.5, mfg: 1.5 };      // job-years per million EUR of equipment cost (Hasim assumption, same order as the PV/wind/battery factors per MEUR)
  const SPEND_EF = 0.3;                          // kg CO₂e per EUR of equipment cost for process equipment (Hasim assumption, spend-based screening value)
  const LPD = 100;                               // litres per person and day (upper value of the UN/WHO 50–100 L range)

  /* ---------------- categories (slots) ----------------
     field: [key, label, unit, min, max, role, options]
     role: model – used by the simulation · check – used by the component checks · env – environmental data · info – datasheet only
     q(size, c): quantities of a size in the units of the factors (capex, emb, land in m², jobs 'unit') */
  const CATS = H2.LIB_CATS = {
    pv: { label: 'Solar PV plant', block: 'supply', size: 'MWp', capexU: 'EUR/kWp', embU: 'kg CO₂e/kWp', landU: 'ha/MWp', jobsU: 'per MWp',
      q: sz => ({ capex: sz * 1000, emb: sz * 1000, land: sz * 1e4, jobs: sz }),
      fields: [['track', 'Plane-of-array gain over GHI (tracking)', '–', 1, 1.5, 'model'], ['loss', 'System losses (DC + AC)', '–', 0, 0.3, 'model'], ['dcac', 'DC/AC ratio', '–', 1, 1.6, 'model'],
        ['gammaT', 'Temperature coefficient of power', '1/K', -0.006, 0, 'model'], ['modW', 'Module power', 'Wp', 200, 800, 'model']] },
    wind: { label: 'Wind turbines', block: 'supply', size: 'MW', capexU: 'EUR/kW', embU: 'kg CO₂e/kW', landU: 'ha/MW (direct)', jobsU: 'per MW',
      q: sz => ({ capex: sz * 1000, emb: sz * 1000, land: sz * 1e4, jobs: sz }),
      fields: [['unitMW', 'Turbine rating', 'MW', 0.5, 15, 'model'], ['vin', 'Cut-in wind speed', 'm/s', 1, 6, 'model'], ['vr', 'Rated wind speed', 'm/s', 8, 16, 'model'], ['vout', 'Cut-out wind speed', 'm/s', 15, 35, 'model'],
        ['loss', 'Wake, availability and electrical losses', '–', 0, 0.3, 'model'], ['iecV', 'Turbine class limit: mean wind at hub (IEC 61400-1)', 'm/s', 5, 12, 'check'],
        ['hub', 'Hub height', 'm', 50, 200, 'info'], ['rotor', 'Rotor diameter', 'm', 50, 260, 'info'], ['landTot', 'Total project area (incl. spacing; 0 offshore)', 'ha/MW', 0, 200, 'env']] },
    battery: { label: 'Battery storage', block: 'supply', size: 'MW', capexU: 'EUR/kWh', embU: 'kg CO₂e/kWh', landU: 'm²/MWh', jobsU: 'per MW',
      q: (sz, c) => { const e = sz * num(c && c.p && c.p.dur, 2); return { capex: e * 1000, emb: e * 1000, land: e, jobs: sz }; },
      fields: [['dur', 'Storage duration', 'h', 0.5, 12, 'model'], ['rte', 'Round-trip efficiency', '–', 0.6, 0.98, 'model'], ['socMin', 'Minimum state of charge', '–', 0, 0.5, 'model'], ['socMax', 'Maximum state of charge', '–', 0.5, 1, 'model'],
        ['cycles', 'Cycle life (to 80 % capacity)', 'cycles', 500, 20000, 'check']] },
    water: { label: 'Water treatment plant', block: 'water', size: 'm³/d', capexU: 'EUR per m³/d', embU: 'kg CO₂e per m³/d', landU: 'm² per m³/d', jobsU: 'per m³/d',
      q: sz => ({ capex: sz, emb: sz, land: sz, jobs: sz }),
      fields: [['src', 'Raw-water source', '', null, null, 'model', ['fresh', 'brackish', 'sea']], ['tdsMax', 'Maximum feed salinity (TDS)', 'g/L', 0.1, 60, 'check'], ['Y1', 'Recovery, pass 1', '–', 0.2, 0.95, 'model'],
        ['Y2', 'Recovery, pass 2 / EDI', '–', 0.5, 1, 'model'], ['sec', 'Specific energy of the plant', 'kWh/m³', 0.2, 8, 'model']] },
    stack: { label: 'Electrolyser stacks and modules', block: 'electrolyser', size: 'MW', capexU: 'EUR/kW', embU: 'kg CO₂e/kW', landU: 'm²/MW (plant incl. BoP)', jobsU: 'per MW',
      q: sz => ({ capex: sz * 1000, emb: sz * 1000, land: sz, jobs: sz }),
      fields: [['tk', 'Technology', '', null, null, 'model', ['PEM', 'AEL', 'AEM', 'SOEC']], ['modMW', 'Module rating', 'MW', 0.1, 50, 'model'], ['T', 'Stack temperature', '°C', 20, 900, 'model'], ['pH2', 'Cathode (hydrogen) pressure', 'bar', 1, 80, 'model'],
        ['jnom', 'Rated current density', 'A/cm²', 0.05, 5, 'model'], ['ASR', 'Area-specific resistance', 'Ω cm²', 0.01, 1, 'model'], ['degr', 'Voltage degradation', 'µV/h', 0, 50, 'model'], ['lifeH', 'Stack life', 'h', 5000, 150000, 'model'],
        ['minLoad', 'Minimum load', '–', 0, 0.9, 'model'], ['pgm', 'Platinum-group metals (Ir + Pt)', 'g/kW', 0, 5, 'env']] },
    psu: { label: 'Power electronics (rectifier + transformer)', block: 'electrolyser', size: 'MW', capexU: 'EUR/kW', embU: 'kg CO₂e/kW', landU: 'm²/MW', jobsU: 'per MW',
      q: sz => ({ capex: sz * 1000, emb: sz * 1000, land: sz, jobs: sz }),
      fields: [['type', 'Rectifier type', '', null, null, 'model', ['IGBT', 'thyristor']], ['eta', 'Efficiency (rectifier + transformer)', '–', 0.9, 0.995, 'model'], ['pf', 'Power factor at rated load', '–', 0.7, 1, 'info']] },
    bop: { label: 'Balance of plant (gas processing, circulation, cooling)', block: 'electrolyser', size: 'MW', capexU: 'EUR/kW', embU: 'kg CO₂e/kW', landU: 'm²/MW', jobsU: 'per MW',
      q: sz => ({ capex: sz * 1000, emb: sz * 1000, land: sz, jobs: sz }),
      fields: [['tk', 'Designed for technology', '', null, null, 'check', ['PEM', 'AEL', 'AEM', 'SOEC']], ['kBoP', 'Variable BoP consumption (× stack DC power)', '–', 0, 0.2, 'model'], ['fixBoP', 'Fixed BoP consumption (× rating)', '–', 0, 0.1, 'model']] },
    compressor: { label: 'Hydrogen compressor', block: 'compressor', size: 'kW', capexU: 'EUR/kW', embU: 'kg CO₂e/kW', landU: 'm²/kW', jobsU: 'per kW',
      q: sz => ({ capex: sz, emb: sz, land: sz, jobs: sz }),
      fields: [['type', 'Compressor type', '', null, null, 'info', ['piston', 'diaphragm']], ['etaS', 'Isentropic efficiency', '–', 0.4, 0.95, 'model'], ['rmax', 'Maximum pressure ratio per stage', '–', 1.5, 6, 'model'],
        ['pmax', 'Maximum discharge pressure', 'bar', 10, 1100, 'check'], ['flowMax', 'Capacity per machine', 'kg/h', 1, 5000, 'check']] },
    storage: { label: 'Hydrogen storage vessels', block: 'storage', size: 'kg', capexU: 'EUR/kg usable', embU: 'kg CO₂e/kg usable', landU: 'm²/kg usable', jobsU: 'per kg',
      q: sz => ({ capex: sz, emb: sz, land: sz, jobs: sz }),
      fields: [['type', 'Vessel type', '', null, null, 'info', ['Type I steel', 'Type III/IV composite']], ['pmax', 'Maximum working pressure', 'bar', 10, 1000, 'check']] },
    pipeline: { label: 'Hydrogen pipeline', block: 'pipeline', size: 'km', capexU: 'MEUR/km', embU: 't CO₂e/km', landU: 'ha/km (right of way)', jobsU: 'per km',
      q: sz => ({ capex: sz * 1e6, emb: sz * 1000, land: sz * 1e4, jobs: sz }),
      fields: [['D', 'Inner diameter', 'm', 0.02, 1.5, 'model'], ['pmax', 'Design pressure', 'bar', 5, 200, 'check']] },
    trailer: { label: 'Tube trailers', block: 'trailer', size: 'trailers', capexU: 'MEUR per trailer', embU: 't CO₂e per trailer', landU: 'm² per trailer', jobsU: 'per trailer',
      q: sz => ({ capex: sz * 1e6, emb: sz * 1000, land: sz, jobs: sz }),
      fields: [['payload', 'Payload', 'kg', 50, 2500, 'model'], ['pmax', 'Working pressure', 'bar', 100, 700, 'check']] },
    hrs: { label: 'Refuelling station', block: 'hrs', size: 't/d', capexU: 'MEUR per t/d', embU: 't CO₂e per t/d', landU: 'm² per t/d', jobsU: 'per t/d',
      q: sz => ({ capex: sz * 1e6, emb: sz * 1000, land: sz, jobs: sz }),
      fields: [['Tout', 'Pre-cooling temperature', '°C', -45, 20, 'model'], ['COP', 'Pre-cooling coefficient of performance', '–', 0.5, 5, 'model'], ['pDisp', 'Nominal working pressure of vehicles', 'bar', 350, 700, 'info']] },
    ammonia: { label: 'Ammonia synthesis and air separation', block: 'ammonia', size: 't/a', capexU: 'EUR per t/a', embU: 'kg CO₂e per t/a', landU: 'm² per t/a', jobsU: 'per t/a',
      q: sz => ({ capex: sz, emb: sz, land: sz, jobs: sz }),
      fields: [['eta', 'Loop yield', '–', 0.8, 1, 'model'], ['eASU', 'Air-separation energy', 'kWh/kg N₂', 0.05, 0.5, 'model'], ['eloop', 'Synthesis-loop energy', 'kWh/kg NH₃', 0.05, 0.8, 'model']] },
    methanol: { label: 'Methanol synthesis', block: 'methanol', size: 't/a', capexU: 'EUR per t/a', embU: 'kg CO₂e per t/a', landU: 'm² per t/a', jobsU: 'per t/a',
      q: sz => ({ capex: sz, emb: sz, land: sz, jobs: sz }),
      fields: [['ecap', 'CO₂ capture energy', 'MWh/t CO₂', 0, 3, 'model'], ['esyn', 'Synthesis energy', 'MWh/t', 0, 2, 'model'], ['co2price', 'CO₂ cost', 'EUR/t', 0, 500, 'model']] },
    fuelcell: { label: 'Fuel-cell power system', block: 'fuelcell', size: 'kW', capexU: 'EUR/kW', embU: 'kg CO₂e/kW', landU: 'm²/kW', jobsU: 'per kW',
      q: sz => ({ capex: sz, emb: sz, land: sz, jobs: sz }),
      fields: [['V', 'Cell voltage', 'V', 0.5, 0.9, 'model'], ['kBoP', 'Balance-of-plant share', '–', 0, 0.3, 'model']] }
  };
  // common economic / environmental / social fields of every component
  H2.LIB_COMMON = [['capex', 'Capital cost', null, 0, 1e7, 'econ'], ['om', 'Fixed O&M (share of CAPEX per year)', '1/a', 0, 0.3, 'econ'], ['life', 'Economic life', 'a', 1, 60, 'econ'],
    ['emb', 'Embodied GHG emissions (manufacture, transport, installation)', null, 0, 1e7, 'env'], ['land', 'Land occupied', null, 0, 1e6, 'env']];
  H2.JOB_BASES = { unit: 'per size unit', MEUR: 'per million EUR of CAPEX', MWH2: 'per MW of hydrogen output (LHV)', driver: '× driver full-time equivalents from the trip plan' };
  H2.BLOCK_SLOTS = { supply: ['pv', 'wind', 'battery'], water: ['water'], electrolyser: ['stack', 'psu', 'bop'], compressor: ['compressor'], storage: ['storage'], pipeline: ['pipeline'], trailer: ['trailer'], hrs: ['hrs'], ammonia: ['ammonia'], methanol: ['methanol'], fuelcell: ['fuelcell'] };
  H2.PLANT_SLOTS = ['pv', 'wind', 'battery', 'water', 'stack', 'psu', 'bop', 'compressor', 'storage', 'pipeline', 'trailer', 'hrs', 'ammonia'];

  /* ---------------- built-in generic components ---------------- */
  const G = (ci, mfg, om) => ({ ci: [ci == null ? H2.JOBS_GENERIC.ci : ci, ci == null ? 'MEUR' : 'unit'], mfg: [mfg == null ? H2.JOBS_GENERIC.mfg : mfg, mfg == null ? 'MEUR' : 'unit'], om: om || [0, 'unit'] });
  const spend = capexPerUnit => Math.round(capexPerUnit * SPEND_EF * 10) / 10;
  const L = H2.LIB = [
    // --- solar PV (jobs: Rutovitz 2025 per MWac ÷ DC/AC 1.25; land: LBNL 2022; modules: ISE 2022 + 150 kg/kWp balance of system)
    { id: 'pv-fixed', cat: 'pv', name: 'PV plant – mono-Si modules, fixed tilt', tech: 'Mono-Si PERC glass-backsheet modules on fixed racks', ref: 'grid',
      p: { track: 1.12, loss: 0.12, dcac: 1.25, gammaT: -0.0035, modW: 620 }, capex: 500, om: 0.015, life: 30, emb: 960, land: 1.15,
      jobs: { ci: [1.29, 'unit'], mfg: [2.46, 'unit'], om: [0.072, 'unit'] }, split: [0.6, 0.25, 0.15], src: ['dm', 'lbnl22', 'ise22', 'pvps24', 'rut25', 'hasim'] },
    { id: 'pv-1axis', cat: 'pv', name: 'PV plant – mono-Si modules, single-axis trackers', tech: 'Mono-Si PERC glass-backsheet modules on horizontal single-axis trackers', ref: 'islanded',
      p: { track: 1.25, loss: 0.12, dcac: 1.25, gammaT: -0.0035, modW: 620 }, capex: 550, om: 0.015, life: 30, emb: 960, land: 1.69,
      jobs: { ci: [1.29, 'unit'], mfg: [2.46, 'unit'], om: [0.072, 'unit'] }, split: [0.6, 0.25, 0.15], src: ['dm', 'lbnl22', 'ise22', 'pvps24', 'rut25', 'hasim'] },
    { id: 'pv-bifacial', cat: 'pv', name: 'PV plant – bifacial glass-glass modules, single-axis trackers', tech: 'Bifacial n-type (TOPCon) glass-glass modules on single-axis trackers',
      p: { track: 1.3, loss: 0.12, dcac: 1.3, gammaT: -0.003, modW: 700 }, capex: 580, om: 0.015, life: 30, emb: 900, land: 1.69,
      jobs: { ci: [1.29, 'unit'], mfg: [2.46, 'unit'], om: [0.072, 'unit'] }, split: [0.6, 0.25, 0.15], src: ['lbnl22', 'ise22', 'rut25', 'hasim'] },
    // --- wind (jobs: Rutovitz 2025; land: NREL 2009; emissions: Vestas 2025 LCA of a V163-4.5 MW plant)
    { id: 'wt-5-ii', cat: 'wind', name: 'Onshore wind turbine 5 MW class, medium wind (IEC II)', tech: 'Three-bladed upwind turbine, ~150 m rotor, 120 m hub', ref: true,
      p: { unitMW: 5, vin: 3, vr: 12, vout: 25, loss: 0.188, iecV: 8.5, hub: 120, rotor: 150, landTot: 34.5 }, capex: 1300, om: 0.025, life: 25, emb: 448, land: 0.3,
      jobs: { ci: [2.65, 'unit'], mfg: [1.54, 'unit'], om: [0.21, 'unit'] }, split: [0.72, 0.2, 0.08], src: ['dm', 'nrel09', 'nrelcwer24', 'vestas25', 'rut25', 'iec', 'hasim'] },
    { id: 'wt-4p5-low', cat: 'wind', name: 'Onshore wind turbine 4.5 MW, large rotor for low wind (IEC III)', tech: 'Low-specific-rating turbine, ~163 m rotor, 125 m hub',
      p: { unitMW: 4.5, vin: 3, vr: 10.5, vout: 25, loss: 0.188, iecV: 7.5, hub: 125, rotor: 163, landTot: 34.5 }, capex: 1400, om: 0.025, life: 25, emb: 448, land: 0.3,
      jobs: { ci: [2.65, 'unit'], mfg: [1.54, 'unit'], om: [0.21, 'unit'] }, split: [0.72, 0.2, 0.08], src: ['nrel09', 'nrelcwer24', 'vestas25', 'rut25', 'iec', 'hasim'] },
    { id: 'wt-4-i', cat: 'wind', name: 'Onshore wind turbine 4.2 MW, high wind (IEC I)', tech: 'High-specific-rating turbine for strong winds, ~117 m rotor, 100 m hub',
      p: { unitMW: 4.2, vin: 3, vr: 13, vout: 25, loss: 0.188, iecV: 10, hub: 100, rotor: 117, landTot: 34.5 }, capex: 1250, om: 0.025, life: 25, emb: 448, land: 0.3,
      jobs: { ci: [2.65, 'unit'], mfg: [1.54, 'unit'], om: [0.21, 'unit'] }, split: [0.72, 0.2, 0.08], src: ['nrel09', 'nrelcwer24', 'vestas25', 'rut25', 'iec', 'hasim'] },
    { id: 'wt-15-off', cat: 'wind', name: 'Offshore wind turbine 15 MW, fixed-bottom (IEC I)', tech: 'IEA 15 MW reference turbine, 240 m rotor, 150 m hub, monopile; sea area not counted as land',
      p: { unitMW: 15, vin: 3, vr: 10.59, vout: 25, loss: 0.155, iecV: 10, hub: 150, rotor: 240, landTot: 0 }, capex: 2650, om: 0.025, life: 25, emb: 887, land: 0,
      jobs: { ci: [1.5, 'unit'], mfg: [13.68, 'unit'], om: [0.28, 'unit'] }, split: [0.6, 0.3, 0.1], src: ['iea15', 'nrelcwer24', 'irena25', 'vestas24', 'rut25', 'iec', 'hasim'] },
    // --- batteries (jobs: Rutovitz 2025 utility batteries; emissions: Lin et al. 2024)
    { id: 'bess-lfp-2h', cat: 'battery', name: 'Battery – LFP lithium-ion, 2-hour containers', tech: 'Lithium iron phosphate cells in 20-ft containers with PCS', ref: true,
      p: { dur: 2, rte: 0.88, socMin: 0.1, socMax: 0.95, cycles: 6000 }, capex: 350, om: 0.02, life: 15, emb: 90.8, land: 20,
      jobs: { ci: [0.53, 'unit'], mfg: [0.31, 'unit'], om: [0.03, 'unit'] }, split: [0.75, 0.15, 0.1], src: ['dm', 'lin24', 'rut25', 'hasim'] },
    { id: 'bess-lfp-4h', cat: 'battery', name: 'Battery – LFP lithium-ion, 4-hour containers', tech: 'Lithium iron phosphate cells, energy-optimised containers',
      p: { dur: 4, rte: 0.87, socMin: 0.1, socMax: 0.95, cycles: 6000 }, capex: 300, om: 0.02, life: 15, emb: 90.8, land: 15,
      jobs: { ci: [0.53, 'unit'], mfg: [0.31, 'unit'], om: [0.03, 'unit'] }, split: [0.75, 0.15, 0.1], src: ['lin24', 'rut25', 'hasim'] },
    // --- water treatment (costs: DM 8.10 values used by Hasim; others Hasim assumptions)
    { id: 'wt-swro', cat: 'water', name: 'Seawater RO with energy recovery + second pass + EDI', tech: 'Open intake, UF pre-treatment, SWRO with ERD, BWRO second pass, EDI polishing', ref: true,
      p: { src: 'sea', tdsMax: 45, Y1: 0.42, Y2: 0.9, sec: 3.5 }, capex: 3500, om: 0.05, life: 25, emb: spend(3500), land: 0.8, jobs: G(), split: [0.6, 0.3, 0.1], src: ['dm', 'hasim'] },
    { id: 'wt-bwro', cat: 'water', name: 'Brackish-water RO + EDI polishing', tech: 'Well water, cartridge filters, BWRO, EDI polishing',
      p: { src: 'brackish', tdsMax: 10, Y1: 0.7, Y2: 0.9, sec: 1.5 }, capex: 2000, om: 0.05, life: 25, emb: spend(2000), land: 0.5, jobs: G(), split: [0.6, 0.3, 0.1], src: ['hasim'] },
    { id: 'wt-ro', cat: 'water', name: 'Municipal water: RO + EDI polishing', tech: 'Activated carbon, softening, single-pass RO, EDI polishing', ref: true,
      p: { src: 'fresh', tdsMax: 2, Y1: 0.75, Y2: 1, sec: 1.0 }, capex: 1500, om: 0.05, life: 25, emb: spend(1500), land: 0.4, jobs: G(), split: [0.6, 0.3, 0.1], src: ['dm', 'hasim'] },
    // --- electrolyser stacks (cell data: Hasim technology presets from CM; stack cost share: DOE 2022 / Columbia 2023; emissions: Wei et al. 2024; O&M jobs: Ganter et al. 2024)
    { id: 'st-pem', cat: 'stack', name: 'PEM stacks – 5 MW modules', tech: 'Proton-exchange membrane, Ir/Pt catalysts, 30 bar cathode', ref: true,
      p: { tk: 'PEM', modMW: 5, T: 80, pH2: 30, jnom: 1.8, ASR: 0.12, degr: 4.8, lifeH: 80000, minLoad: 0.1, pgm: 0.8 }, capex: 675, om: 0.025, life: 25, emb: 137.5, land: 250,
      jobs: { ci: [1.5, 'MEUR'], mfg: [1.5, 'MEUR'], om: [0.9, 'MWH2'] }, split: [1, 0, 0], src: ['cm', 'doe22', 'scheepers20', 'col23', 'wei24', 'ganter24', 'hasim'] },
    { id: 'st-ael', cat: 'stack', name: 'Alkaline stacks – pressurised, 5 MW modules', tech: 'Alkaline (30 wt-% KOH), nickel electrodes, 30 bar', ref: true,
      p: { tk: 'AEL', modMW: 5, T: 80, pH2: 30, jnom: 0.4, ASR: 0.18, degr: 3.2, lifeH: 80000, minLoad: 0.2, pgm: 0 }, capex: 450, om: 0.025, life: 25, emb: 253.7, land: 350,
      jobs: { ci: [1.5, 'MEUR'], mfg: [1.5, 'MEUR'], om: [0.9, 'MWH2'] }, split: [1, 0, 0], src: ['cm', 'doeael', 'col23', 'wei24', 'ganter24', 'hasim'] },
    { id: 'st-ael-10', cat: 'stack', name: 'Alkaline stacks – large pressurised, 10 MW modules', tech: 'Alkaline, large-area cells, 10 MW per module, 30 bar',
      p: { tk: 'AEL', modMW: 10, T: 80, pH2: 30, jnom: 0.4, ASR: 0.18, degr: 3.2, lifeH: 80000, minLoad: 0.2, pgm: 0 }, capex: 420, om: 0.025, life: 25, emb: 253.7, land: 330,
      jobs: { ci: [1.5, 'MEUR'], mfg: [1.5, 'MEUR'], om: [0.9, 'MWH2'] }, split: [1, 0, 0], src: ['cm', 'doeael', 'wei24', 'ganter24', 'hasim'] },
    { id: 'st-aem', cat: 'stack', name: 'AEM stacks – 1 MW modules', tech: 'Anion-exchange membrane, PGM-free catalysts, 10 bar', ref: true,
      p: { tk: 'AEM', modMW: 1, T: 60, pH2: 10, jnom: 1.0, ASR: 0.12, degr: 20, lifeH: 20000, minLoad: 0.1, pgm: 0 }, capex: 230, om: 0.025, life: 25, emb: 99.2, land: 300,
      jobs: { ci: [1.5, 'MEUR'], mfg: [1.5, 'MEUR'], om: [0.9, 'MWH2'] }, split: [1, 0, 0], src: ['cm', 'enapter', 'col23', 'wei24', 'ganter24', 'hasim'] },
    { id: 'st-soec', cat: 'stack', name: 'Solid-oxide stacks – 1 MW modules', tech: 'Solid oxide electrolysis cells, steam at 700–850 °C', ref: true,
      p: { tk: 'SOEC', modMW: 1, T: 800, pH2: 1, jnom: 0.8, ASR: 0.25, degr: 7, lifeH: 30000, minLoad: 0.3, pgm: 0 }, capex: 660, om: 0.025, life: 25, emb: 102.6, land: 400,
      jobs: { ci: [1.5, 'MEUR'], mfg: [1.5, 'MEUR'], om: [0.9, 'MWH2'] }, split: [1, 0, 0], src: ['cm', 'doehte', 'schefold17', 'col23', 'wei24', 'ganter24', 'hasim'] },
    // --- power electronics
    { id: 'psu-igbt', cat: 'psu', name: 'IGBT active front-end rectifier + transformer', tech: 'PWM rectifier, power factor ≈ 0.99, low harmonics', ref: true,
      p: { type: 'IGBT', eta: 0.97, pf: 0.99 }, capex: 200, om: 0.01, life: 20, emb: spend(200), land: 0, jobs: G(), split: [1, 0, 0], src: ['cm', 'hasim'] },
    { id: 'psu-thy', cat: 'psu', name: '12-pulse thyristor rectifier + transformer + harmonic filter', tech: 'Line-commutated rectifier with 11th/13th filters or STATCOM',
      p: { type: 'thyristor', eta: 0.975, pf: 0.9 }, capex: 170, om: 0.01, life: 20, emb: spend(170), land: 0, jobs: G(), split: [1, 0, 0], src: ['dm', 'hasim'] },
    // --- balance of plant (cost = CM technology cost – stack – power electronics)
    { id: 'bop-pem', cat: 'bop', name: 'Balance of plant for PEM – water loop, separators, deoxo + dryer, dry coolers', tech: 'DI-water circulation, gas–liquid separators, Pd deoxo, TSA dryer, dry coolers', ref: true,
      p: { tk: 'PEM', kBoP: 0.03, fixBoP: 0.01 }, capex: 625, om: 0.025, life: 25, emb: spend(625), land: 0, jobs: G(), split: [0.8, 0.2, 0], src: ['cm', 'hasim'] },
    { id: 'bop-ael', cat: 'bop', name: 'Balance of plant for alkaline – lye loop, separators, deoxo + dryer, dry coolers', tech: 'KOH circulation, separators, lye filters, Pd deoxo, TSA dryer, dry coolers', ref: true,
      p: { tk: 'AEL', kBoP: 0.03, fixBoP: 0.01 }, capex: 380, om: 0.025, life: 25, emb: spend(380), land: 0, jobs: G(), split: [0.8, 0.2, 0], src: ['cm', 'hasim'] },
    { id: 'bop-aem', cat: 'bop', name: 'Balance of plant for AEM', tech: 'Dilute-electrolyte circulation, separators, deoxo, dryer, dry coolers', ref: true,
      p: { tk: 'AEM', kBoP: 0.03, fixBoP: 0.01 }, capex: 720, om: 0.025, life: 25, emb: spend(720), land: 0, jobs: G(), split: [0.8, 0.2, 0], src: ['cm', 'hasim'] },
    { id: 'bop-soec', cat: 'bop', name: 'Balance of plant for SOEC – steam generator, recuperators, hot box', tech: 'Steam generation, high-temperature recuperators, electric heaters, hot box', ref: true,
      p: { tk: 'SOEC', kBoP: 0.03, fixBoP: 0.01 }, capex: 1340, om: 0.025, life: 25, emb: spend(1340), land: 0, jobs: G(), split: [0.8, 0.2, 0], src: ['cm', 'hasim'] },
    // --- compression
    { id: 'cp-piston', cat: 'compressor', name: 'Reciprocating piston compressor, oil-free', tech: 'Multistage, intercooled, oil-free piston machines (n + 1 redundancy)', ref: true,
      p: { type: 'piston', etaS: 0.75, rmax: 2.3, pmax: 1000, flowMax: 500 }, capex: 3000, om: 0.04, life: 20, emb: spend(3000), land: 0, jobs: G(), split: [0.8, 0.15, 0.05], src: ['dm', 'hasim'] },
    { id: 'cp-diaph', cat: 'compressor', name: 'Diaphragm compressor for small flows and high pressure', tech: 'Metal-diaphragm heads, hermetically sealed, 2–3 stages',
      p: { type: 'diaphragm', etaS: 0.65, rmax: 3, pmax: 1000, flowMax: 100 }, capex: 4500, om: 0.05, life: 20, emb: spend(4500), land: 0, jobs: G(), split: [0.8, 0.15, 0.05], src: ['hasim'] },
    // --- storage (costs: DM example cases)
    { id: 'sv-type1', cat: 'storage', name: 'Steel pressure vessels (Type I), up to 300 bar', tech: 'Seamless or forged steel vessels / tube bundles', ref: true,
      p: { type: 'Type I steel', pmax: 300 }, capex: 600, om: 0.02, life: 30, emb: spend(600), land: 0.06, jobs: G(), split: [0.7, 0.25, 0.05], src: ['dm', 'hasim'] },
    { id: 'sv-type4', cat: 'storage', name: 'Composite vessels (Type III/IV), 350–500 bar', tech: 'Carbon-fibre-wrapped vessels with metal or polymer liner',
      p: { type: 'Type III/IV composite', pmax: 500 }, capex: 900, om: 0.02, life: 25, emb: spend(900), land: 0.025, jobs: G(), split: [0.7, 0.25, 0.05], src: ['dm', 'hasim'] },
    // --- delivery
    { id: 'pl-dn300', cat: 'pipeline', name: 'Steel pipeline DN300 (L360 / X52), buried', tech: 'Hydrogen-service line pipe, cathodic protection', ref: true,
      p: { D: 0.3, pmax: 100 }, capex: 1.2, om: 0.01, life: 40, emb: spend(1.2e6) / 1000, land: 2, jobs: G(null, null, [0.05, 'unit']), split: [0.4, 0.5, 0.1], src: ['dm', 'hasim'] },
    { id: 'pl-dn100', cat: 'pipeline', name: 'Steel pipeline DN100, short connection', tech: 'Hydrogen-service line pipe to a nearby customer',
      p: { D: 0.1, pmax: 100 }, capex: 0.65, om: 0.01, life: 40, emb: spend(0.65e6) / 1000, land: 1.5, jobs: G(null, null, [0.05, 'unit']), split: [0.4, 0.5, 0.1], src: ['dm', 'hasim'] },
    { id: 'tt-steel', cat: 'trailer', name: 'Tube trailer – steel tubes, 200 bar', tech: 'Type I steel tubes on a semi-trailer, ~330 kg payload',
      p: { payload: 330, pmax: 200 }, capex: 0.35, om: 0.03, life: 20, emb: spend(0.35e6) / 1000, land: 0, jobs: G(0, null, [1, 'driver']), split: [1, 0, 0], src: ['cm', 'hasim'] },
    { id: 'tt-comp', cat: 'trailer', name: 'Tube trailer – composite tubes, 500 bar', tech: 'Type IV tubes in a container frame, ~1 000 kg payload', ref: true,
      p: { payload: 1000, pmax: 500 }, capex: 0.9, om: 0.03, life: 20, emb: spend(0.9e6) / 1000, land: 0, jobs: G(0, null, [1, 'driver']), split: [1, 0, 0], src: ['cm', 'hasim'] },
    { id: 'hrs-700', cat: 'hrs', name: 'Refuelling station 70 MPa – booster, 900 bar cascade, pre-cooling', tech: 'Booster compressor, cascade storage, −40 °C pre-cooling, dispensers', ref: true,
      p: { Tout: -40, COP: 1.2, pDisp: 700 }, capex: 3, om: 0.05, life: 20, emb: spend(3e6) / 1000, land: 1200, jobs: G(null, null, [1.5, 'unit']), split: [0.7, 0.25, 0.05], src: ['dm', 'hasim'] },
    // --- conversion and end use
    { id: 'nh3-hb', cat: 'ammonia', name: 'Haber–Bosch loop + air separation (electrically driven)', tech: 'Synthesis loop at 150 bar, cryogenic ASU, refrigerated tank', ref: true,
      p: { eta: 0.97, eASU: 0.12, eloop: 0.12 }, capex: 1650, om: 0.03, life: 25, emb: spend(1650), land: 0.27, jobs: G(null, null, [0.0005, 'unit']), split: [0.6, 0.3, 0.1], src: ['cm', 'dm', 'hasim'] },
    { id: 'meoh-co2', cat: 'methanol', name: 'Methanol synthesis from captured CO₂', tech: 'CO₂ hydrogenation loop with distillation; CO₂ from capture', ref: true,
      p: { ecap: 0.5, esyn: 0.6, co2price: 60 }, capex: 900, om: 0.03, life: 25, emb: spend(900), land: 0.2, jobs: G(null, null, [0.0005, 'unit']), split: [0.6, 0.3, 0.1], src: ['cm', 'hasim'] },
    { id: 'fc-pem', cat: 'fuelcell', name: 'PEM fuel-cell power system', tech: 'Stationary PEM fuel cells with inverter and BoP', ref: true,
      p: { V: 0.7, kBoP: 0.12 }, capex: 2000, om: 0.03, life: 10, emb: spend(2000), land: 0.05, jobs: G(), split: [0.85, 0.1, 0.05], src: ['cm', 'hasim'] }
  ];
  L.forEach(c => { c.builtin = true; c.maker = 'Generic (Hasim library)'; });
  const BY_ID = {}; L.forEach(c => { BY_ID[c.id] = c; });
  H2.libGet = id => (own(BY_ID, id) ? clone(BY_ID[id]) : null);
  H2.libList = cat => L.filter(c => c.cat === cat).map(clone);
  H2.libUnits = function (cat) {
    const c = own(CATS, cat); return c ? { size: c.size, capex: c.capexU, emb: c.embU, land: c.landU, jobs: c.jobsU } : null;
  };

  /* ---------------- sanitising components from files and user input ---------------- */
  H2.libClean = function (o) {
    if (!o || typeof o !== 'object') return null;
    const cat = own(CATS, o.cat); if (!cat) return null;
    const base = L.find(c => c.cat === o.cat && c.ref) || L.find(c => c.cat === o.cat);
    const txt = (v, d, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n || 120) : d);
    const c = { id: txt(o.id, 'u-' + o.cat, 60).replace(/[^\w.-]/g, '_'), cat: o.cat, name: txt(o.name, base.name), tech: txt(o.tech, '', 160), maker: txt(o.maker, 'User', 80), desc: txt(o.desc, '', 400), builtin: false, p: {} };
    cat.fields.forEach(f => {
      const [k, , , mn, mx, , opts] = f; const v = o.p && typeof o.p === 'object' ? o.p[k] : undefined;
      if (opts) c.p[k] = opts.includes(v) ? v : base.p[k];
      else c.p[k] = clamp(num(v, base.p[k]), mn, mx);
    });
    H2.LIB_COMMON.forEach(f => { c[f[0]] = clamp(num(o[f[0]], base[f[0]]), f[3], f[4]); });
    c.jobs = {};
    ['ci', 'mfg', 'om'].forEach(k => { const j = o.jobs && Array.isArray(o.jobs[k]) ? o.jobs[k] : base.jobs[k]; const b = own(H2.JOB_BASES, j[1]) ? j[1] : base.jobs[k][1]; c.jobs[k] = [clamp(num(j[0], base.jobs[k][0]), 0, 1e4), b]; });
    let s = Array.isArray(o.split) && o.split.length === 3 ? o.split.map(v => Math.max(0, num(v, 0))) : base.split.slice(); const t = s[0] + s[1] + s[2];
    c.split = t > 0 ? s.map(v => +(v / t).toFixed(4)) : base.split.slice();
    c.src = Array.isArray(o.src) ? o.src.filter(k => own(H2.LIB_SOURCES, k)).slice(0, 12) : [];
    if (o.ref) c.ref = o.ref === true || o.ref === 'grid' || o.ref === 'islanded' ? o.ref : undefined;
    if (!c.ref) delete c.ref;
    if (o.modified) c.modified = true;
    // the "Hasim library" badge only for an unchanged built-in component
    const bi = own(BY_ID, o.id); if (bi && o.builtin) { const ref = H2.libClean(Object.assign(clone(bi), { builtin: false })); c.builtin = !!ref && JSON.stringify(Object.assign({}, ref, { maker: c.maker, builtin: false })) === JSON.stringify(Object.assign({}, c, { builtin: false })); if (c.builtin) c.maker = bi.maker; }
    return c;
  };
  H2.libCleanSet = function (set, allowed) {
    const out = {}; if (!set || typeof set !== 'object') return out;
    Object.keys(set).forEach(k => { if (!own(CATS, k) || (allowed && !allowed.includes(k))) return; const c = H2.libClean(set[k]); if (c && c.cat === k) out[k] = c; });
    return out;
  };

  /* ---------------- default component of a slot (used when nothing is selected) ---------------- */
  H2.libDefault = function (slot, ctx) {
    ctx = ctx || {}; let id;
    switch (slot) {
      case 'pv': id = ctx.islanded === false ? 'pv-fixed' : (ctx.track && ctx.track < 1.18 ? 'pv-fixed' : 'pv-1axis'); break;
      case 'wind': id = ctx.vmean > 8.5 ? 'wt-4-i' : ctx.vmean > 0 && ctx.vmean <= 7.5 ? 'wt-4p5-low' : 'wt-5-ii'; break;   // turbine class for the site wind (IEC 61400-1)
      case 'battery': id = 'bess-lfp-2h'; break;
      case 'water': id = ctx.TDS > 10 ? 'wt-swro' : ctx.TDS > 2 ? 'wt-bwro' : 'wt-ro'; break;
      case 'stack': id = { PEM: 'st-pem', AEL: 'st-ael', AEM: 'st-aem', SOEC: 'st-soec' }[ctx.tech] || 'st-ael'; break;
      case 'psu': id = ctx.tech === 'AEL' ? 'psu-thy' : 'psu-igbt'; break;
      case 'bop': id = { PEM: 'bop-pem', AEL: 'bop-ael', AEM: 'bop-aem', SOEC: 'bop-soec' }[ctx.tech] || 'bop-ael'; break;
      case 'compressor': id = 'cp-piston'; break;
      case 'storage': id = ctx.p > 300 ? 'sv-type4' : 'sv-type1'; break;
      case 'pipeline': id = ctx.D && ctx.D < 0.2 ? 'pl-dn100' : 'pl-dn300'; break;
      case 'trailer': id = ctx.payload && ctx.payload < 700 ? 'tt-steel' : 'tt-comp'; break;
      default: id = { hrs: 'hrs-700', ammonia: 'nh3-hb', methanol: 'meoh-co2', fuelcell: 'fc-pem' }[slot];
    }
    const c = H2.libGet(id); if (c) c.isDefault = true; return c;
  };

  /* ---------------- Model builder: block parameters set by components ---------------- */
  // for every block and slot: the block parameters that the component defines (shown locked in the block editor)
  H2.COMP_LOCKS = { supply: { pv: ['track'], battery: ['batE'] }, water: { water: ['Y1', 'Y2', 'capex'] }, electrolyser: { stack: ['tech', 'minLoad', 'T', 'p', 'capex'], psu: ['capex'], bop: ['capex'] },
    compressor: { compressor: ['rmax', 'eta', 'capex'] }, storage: { storage: ['capex'] }, pipeline: { pipeline: ['D', 'capex'] }, trailer: { trailer: ['payload', 'trailerCost'] }, hrs: { hrs: ['Tout', 'capex'] },
    ammonia: { ammonia: ['eta', 'eASU', 'eloop', 'capex'] }, methanol: { methanol: ['ecap', 'esyn', 'co2price', 'capex'] }, fuelcell: { fuelcell: ['V', 'kBoP', 'capex'] } };
  H2.lockedParams = function (block) {
    const out = {}; const m = H2.COMP_LOCKS[block && block.type]; if (!m || !block.comps) return out;
    Object.keys(m).forEach(slot => { const c = block.comps[slot]; if (c) m[slot].forEach(k => { out[k] = c.name; }); });
    return out;
  };
  /* parameters of a block with its components applied; p._c carries the component data for the block model */
  H2.blockParamsWithComps = function (type, p, comps) {
    comps = comps || {}; const q = Object.assign({}, p); const c = k => comps[k];
    switch (type) {
      case 'supply': {
        if (c('pv')) { const x = c('pv'); q.track = x.p.track; q._pv = { losses: x.p.loss, dcac: x.p.dcac, gammaT: x.p.gammaT, capex_EURkWp: x.capex, om_frac: x.om }; }
        if (c('wind')) { const x = c('wind'); q._wind = { v_in: x.p.vin, v_rated: x.p.vr, v_out: x.p.vout, losses: x.p.loss, capex_EURkW: x.capex, om_frac: x.om }; }
        if (c('battery')) { const x = c('battery'); q.batE = +(num(q.bat, 0) * x.p.dur).toPrecision(8); q._bat = { eta_rt: x.p.rte, soc_min: x.p.socMin, soc_max: x.p.socMax, capex_EURkWh: x.capex, om_frac: x.om }; }
        break;
      }
      case 'water': if (c('water')) { const x = c('water'); q.Y1 = x.p.Y1; q.Y2 = x.p.Y2; q.capex = x.capex; q._w = { sec: x.p.sec, om: x.om }; } break;
      case 'electrolyser': {
        const st = c('stack'), ps = c('psu'), bp = c('bop');
        if (st) { q.tech = st.p.tk; q.minLoad = st.p.minLoad; q.T = st.p.T; q.p = st.p.pH2; q._tp = { T_C: st.p.T, Tref_C: st.p.T, pH2: st.p.pH2, jnom: st.p.jnom, ASR: st.p.ASR, degr_uVh: st.p.degr, stackLife_h: st.p.lifeH, minLoad: st.p.minLoad }; }
        if (st || ps || bp) {
          const tech = st ? st.p.tk : q.tech;
          const S = st || H2.libDefault('stack', { tech }), PS = ps || H2.libDefault('psu', { tech }), B = bp || H2.libDefault('bop', { tech });
          const tot = Math.max(1, S.capex + PS.capex + B.capex);
          q.capex = S.capex + PS.capex + B.capex;
          q._ely = { eta_rect: PS.p.eta, k_BoP: B.p.kBoP, BoP_fixed_frac: B.p.fixBoP, stack_frac: S.capex / tot, om_frac: (S.capex * S.om + PS.capex * PS.om + B.capex * B.om) / tot, shares: [S.capex / tot, PS.capex / tot, B.capex / tot] };
        }
        break;
      }
      case 'compressor': if (c('compressor')) { const x = c('compressor'); q.rmax = x.p.rmax; q.eta = x.p.etaS; q.capex = x.capex; q._om = x.om; } break;
      case 'storage': if (c('storage')) { const x = c('storage'); q.capex = x.capex; q._om = x.om; } break;
      case 'pipeline': if (c('pipeline')) { const x = c('pipeline'); q.D = x.p.D; q.capex = x.capex; q._om = x.om; } break;
      case 'trailer': if (c('trailer')) { const x = c('trailer'); q.payload = x.p.payload; q.trailerCost = x.capex; } break;
      case 'hrs': if (c('hrs')) { const x = c('hrs'); q.Tout = x.p.Tout; q.capex = x.capex; q._COP = x.p.COP; q._om = x.om; } break;
      case 'ammonia': if (c('ammonia')) { const x = c('ammonia'); q.eta = x.p.eta; q.eASU = x.p.eASU; q.eloop = x.p.eloop; q.capex = x.capex; q._om = x.om; } break;
      case 'methanol': if (c('methanol')) { const x = c('methanol'); q.ecap = x.p.ecap; q.esyn = x.p.esyn; q.co2price = x.p.co2price; q.capex = x.capex; q._om = x.om; } break;
      case 'fuelcell': if (c('fuelcell')) { const x = c('fuelcell'); q.V = x.p.V; q.kBoP = x.p.kBoP; q.capex = x.capex; q._om = x.om; } break;
    }
    return q;
  };

  /* ---------------- plant: design-basis values and model settings from components ---------------- */
  /* typical raw water of each source (Hasim assumption; seawater and municipal water as in the New Project wizard) – TDS g/L, ions mg/L, price EUR/m³ */
  H2.RAW_WATER = { sea: { TDS: 41, Ca: 420, SO4: 2700, Alk: 120, pH: 8.1, waterPrice: 0.1 }, brackish: { TDS: 5, Ca: 150, SO4: 400, Alk: 250, pH: 7.8, waterPrice: 0.3 }, fresh: { TDS: 0.5, Ca: 80, SO4: 60, Alk: 200, pH: 7.6, waterPrice: 1.5 } };
  H2.waterClass = tds => (tds > 10 ? 'sea' : tds > 2 ? 'brackish' : 'fresh');
  /* basis fields that a component sets when it is applied to a plant project */
  H2.basisFromComponent = function (b, slot, c) {
    const ch = {}; const P = b.modules * b.moduleMW;
    const comp = Object.assign({}, b.comp || {}); comp[slot] = c;
    const tech = (comp.stack && comp.stack.p.tk) || b.tech;
    switch (slot) {
      case 'pv': ch.pvCapex = c.capex; break;
      case 'wind': ch.windCapex = c.capex; break;
      case 'battery': ch.batCapex = c.capex; if (b.batMW > 0) ch.batMWh = +(b.batMW * c.p.dur).toPrecision(8); break;
      case 'water': {
        ch.Y1 = c.p.Y1; ch.Y2 = c.p.Y2; ch.water = c.p.src === 'sea' ? 'seawater' : 'municipal';
        if (H2.waterClass(b.TDS) !== c.p.src) Object.assign(ch, H2.RAW_WATER[c.p.src]);   // another source: typical raw water of that source (edit it in the design basis)
        break;
      }
      case 'storage': ch.storeCapex = c.capex; break;
      case 'stack': {
        ch.tech = c.p.tk; ch.minLoad = c.p.minLoad; ch.moduleMW = c.p.modMW; ch.modules = clamp(Math.round(P / c.p.modMW) || 1, 1, 200);
        if (comp.bop && comp.bop.p.tk !== c.p.tk) comp.bop = H2.libDefault('bop', { tech: c.p.tk });
        break;
      }
    }
    if (slot === 'stack' || slot === 'psu' || slot === 'bop') {
      const S = comp.stack || H2.libDefault('stack', { tech }), PS = comp.psu || H2.libDefault('psu', { tech }), B = comp.bop || H2.libDefault('bop', { tech });
      ch.capexEly = Math.round(S.capex + PS.capex + B.capex); ch.stackFrac = +(S.capex / Math.max(1, ch.capexEly)).toFixed(3);
    }
    // values set by a component stay inside the limits of the design basis (H2.BASIS_LIMITS)
    const L = H2.BASIS_LIMITS || {}; Object.keys(ch).forEach(k => { const l = own(L, k); if (l && typeof ch[k] === 'number') { let v = clamp(ch[k], l[0], l[1]); if (l[2]) v = Math.round(v); ch[k] = v; } });
    if (ch.stackFrac != null) ch.stackFrac = Math.min(ch.stackFrac, 0.8);
    ch.comp = comp;
    return ch;
  };
  /* equipment replaced within the economic life other than the stacks: power electronics (share of the electrolyser
     CAPEX from the components) and, optionally, the battery – one list for the LCOH and the impact assessment */
  H2.replacementItems = function (b, elyCap, withBattery) {
    const cm = b.comp || {}, tech = (cm.stack && cm.stack.p.tk) || b.tech, out = [];
    const PS = cm.psu || H2.libDefault('psu', { tech }), BO = cm.bop || H2.libDefault('bop', { tech });
    const sf = clamp(num(b.stackFrac, 0.3), 0, 0.95);
    if (PS && BO && elyCap > 0) out.push({ name: 'Power electronics', capex: elyCap * (1 - sf) * PS.capex / Math.max(1e-9, PS.capex + BO.capex), life: PS.life });
    if (withBattery !== false && b.batMWh > 0) { const BT = cm.battery || H2.libDefault('battery', {}); out.push({ name: 'Battery', capex: b.batMWh * b.batCapex / 1000, life: BT ? BT.life : 15 }); }
    return out;
  };
  /* overrides of the plant models derived from the components of a design basis (no components → no overrides) */
  H2.compModel = function (b) {
    const cm = (b && b.comp) || {}; const o = {};
    // stack data only for the technology of the design basis (a mismatch is reported by the component checks)
    if (cm.stack && cm.stack.p.tk === b.tech) { const x = cm.stack.p; o.tp = { T_C: x.T, Tref_C: x.T, pH2: x.pH2, jnom: x.jnom, ASR: x.ASR, degr_uVh: x.degr, stackLife_h: x.lifeH }; }
    if (cm.psu) { o.eta_rect = cm.psu.p.eta; o.psuType = cm.psu.p.type; }
    if (cm.bop) { o.k_BoP = cm.bop.p.kBoP; o.fixBoP = cm.bop.p.fixBoP; }
    if (cm.pv) o.pv = { tracking: cm.pv.p.track, losses: cm.pv.p.loss, dcac: cm.pv.p.dcac, gammaT: cm.pv.p.gammaT, modW: cm.pv.p.modW, om: cm.pv.om };
    if (cm.wind) o.wind = { v_in: cm.wind.p.vin, v_rated: cm.wind.p.vr, v_out: cm.wind.p.vout, losses: cm.wind.p.loss, unitMW: cm.wind.p.unitMW, om: cm.wind.om };
    if (cm.battery) o.bat = { eta_rt: cm.battery.p.rte, soc_min: cm.battery.p.socMin, soc_max: cm.battery.p.socMax, om: cm.battery.om };
    if (cm.compressor) o.cmp = { etaS: cm.compressor.p.etaS, rmax: cm.compressor.p.rmax, flowMax: cm.compressor.p.flowMax };
    return o;
  };

  /* =====================================================================
     COMPONENT CHECKS
     ===================================================================== */
  const chk = (out, group, name, value, limit, ok, ref, unit) => out.push({ group, name, value, limit, ok: !!ok, ref, unit: unit || '' });
  /* H₂ in O₂ at the minimum load with the stack data of a component (CM 7.7, DM 10.2) */
  function h2inO2(tech, tpo, minLoad, ely) {
    try { const tp = Object.assign({}, H2.TECH[tech] || H2.TECH.PEM, tpo || {}); const sys = H2.system(tp, 1000, { eta_rect: (ely && ely.eta_rect) || 0.97, eta_trafo: 0.99, P_BoP_fixed_frac: ely ? ely.BoP_fixed_frac : 0.01, k_BoP: ely ? ely.k_BoP : 0.03 }); return sys.atLoad(Math.max(0.01, minLoad)).xH2inO2; } catch (e) { return null; }
  }
  H2.h2inO2 = h2inO2;
  /* checks of a Model-builder chain after it has been run */
  H2.chainChecks = function (blocks, s, set) {
    const out = []; set = set || {}; const has = t => blocks.some(b => b.type === t); const comp = slot => { for (const b of blocks) if (b.comps && b.comps[slot]) return b.comps[slot]; return null; };
    if (set.target > 0) chk(out, 'Performance', 'Annual hydrogen production vs target', s.H2_ta, '≥ ' + Math.round(set.target) + ' t/a', s.H2_ta >= 0.97 * set.target, 'model', 't/a');
    if (s.ely) {
      const x = h2inO2(s.ely.tech, s.ely.tp, s.ely.minLoadEff != null ? s.ely.minLoadEff : s.ely.minLoad, s.ely.ely);
      if (x != null) chk(out, 'Electrolysis', 'H₂ in O₂ at the operating minimum load', 100 * x, '≤ 2 % (trip)', x <= 0.02 + 1e-6, 'CM 7.7 / ISO 22734-1', '%');
      const st = comp('stack'); if (st) chk(out, 'Components', 'Module rating ≤ electrolyser rating', st.p.modMW, '≤ ' + s.ely.P + ' MW', st.p.modMW <= s.ely.P + 1e-9, 'component', 'MW');
      const bp = comp('bop'); if (bp) chk(out, 'Components', 'Balance of plant matches the stack technology', bp.p.tk, s.ely.tech, bp.p.tk === s.ely.tech, 'component');
      if (s.hourly) {
        chk(out, 'Power', 'Unserved auxiliary energy', s.hourly.kpi.unmet_MWh, '= 0 MWh', s.hourly.kpi.unmet_MWh < 1, 'DM 4.3', 'MWh/a');
        const wd = comp('wind'); if (wd && s.supply && s.supply.wind > 0) chk(out, 'Components', 'Site wind within the turbine class (' + wd.name.replace(/.*\((IEC [^)]*)\).*/, '$1') + ')', s.supply.v, '≤ ' + wd.p.iecV + ' m/s', s.supply.v <= wd.p.iecV + 1e-9, 'IEC 61400-1', 'm/s');
        const bt = comp('battery'); if (bt && s.supply && s.supply.bat > 0) { const cyc = s.hourly.kpi.bat_cycles * bt.life; chk(out, 'Components', 'Battery cycles over its life', cyc, '≤ ' + bt.p.cycles + ' cycles', cyc <= bt.p.cycles, 'component'); }
      }
    }
    const wt = comp('water'); if (wt && s.waterCfg) chk(out, 'Components', 'Feed salinity within the water-plant design', s.waterCfg.TDS, '≤ ' + wt.p.tdsMax + ' g/L', s.waterCfg.TDS <= wt.p.tdsMax + 1e-9, 'component', 'g/L');
    (s.comps || []).forEach((c, k) => {
      chk(out, 'Compression', 'Stage discharge temperature' + (s.comps.length > 1 ? ' (compressor ' + (k + 1) + ')' : ''), c.T2, '≤ ' + (c.Tlim || 120) + ' °C (API 618, 6th ed.)', c.T2 <= (c.Tlim || 120) + 0.5, 'DM 12.1 / API 618', '°C');
      const cp = comp('compressor'); if (cp) { chk(out, 'Components', 'Discharge pressure within the compressor rating', c.p2, '≤ ' + cp.p.pmax + ' bar', c.p2 <= cp.p.pmax, 'component', 'bar'); chk(out, 'Components', 'Compressor machines needed (' + cp.p.flowMax + ' kg/h each)', Math.max(1, Math.ceil(c.m / cp.p.flowMax)), '+ 1 standby', true, 'component', 'units'); }
    });
    if (s.store) { const sv = comp('storage'); if (sv) chk(out, 'Components', 'Storage pressure within the vessel rating', s.store.pmax, '≤ ' + sv.p.pmax + ' bar', s.store.pmax <= sv.p.pmax, 'component', 'bar'); }
    if (has('storage') && !s.store && s.H2_ta > 0) chk(out, 'Storage', 'Storage receives compressed hydrogen', 'no', 'compressor before storage', false, 'DM 13.1');
    if (s.pipe) { chk(out, 'Transport', 'Pipeline capacity vs design flow', s.pipe.cap, '≥ ' + Math.round(s.pipe.flow) + ' kg/h', s.pipe.cap >= s.pipe.flow, 'CM 13.1', 'kg/h');
      const pl = comp('pipeline'); if (pl) chk(out, 'Components', 'Inlet pressure within the pipeline design pressure', s.pipe.pin, '≤ ' + pl.p.pmax + ' bar', s.pipe.pin <= pl.p.pmax, 'component', 'bar'); }
    const tt = comp('trailer'); if (tt && s.trailerP != null) chk(out, 'Components', 'Supply pressure reaches the trailer working pressure', s.trailerP, '≥ ' + tt.p.pmax + ' bar', s.trailerP >= tt.p.pmax - 1e-9, 'component', 'bar');
    if (s.hrs) chk(out, 'Refuelling', 'Fuel delivery temperature window (T40)', s.hrs.Tout, '−40 to −33 °C', s.hrs.Tout >= -40 && s.hrs.Tout <= -33, 'SAE J2601', '°C');
    if (s.CI != null) chk(out, 'Environment', 'GHG intensity, hourly correlation (RFNBO method)', s.CI, '≤ 3.38 kg/kg', s.CI <= 3.38, '2023/1185 / CM 18.1', 'kg/kg');
    return out;
  };
  /* component checks of a plant design (added to the design checks of the solver) */
  H2.plantComponentChecks = function (b, sys) {
    const out = [], cm = b.comp || {}; if (!Object.keys(cm).length) return out;
    if (cm.water) chk(out, 'Components', 'Feed salinity within the water-plant design', b.TDS, '≤ ' + cm.water.p.tdsMax + ' g/L', b.TDS <= cm.water.p.tdsMax + 1e-9, 'component', 'g/L');
    if (cm.bop) chk(out, 'Components', 'Balance of plant matches the stack technology', cm.bop.p.tk, b.tech, cm.bop.p.tk === b.tech, 'component');
    if (cm.stack) chk(out, 'Components', 'Stack component matches the design-basis technology', cm.stack.p.tk, b.tech, cm.stack.p.tk === b.tech, 'component');
    if (cm.storage) chk(out, 'Components', 'Storage pressure within the vessel rating', b.storeP, '≤ ' + cm.storage.p.pmax + ' bar', b.storeP <= cm.storage.p.pmax, 'component', 'bar');
    if (cm.compressor) chk(out, 'Components', 'Discharge pressure within the compressor rating', b.storeP, '≤ ' + cm.compressor.p.pmax + ' bar', b.storeP <= cm.compressor.p.pmax, 'component', 'bar');
    if (cm.pipeline && sys && sys.endUse && sys.endUse.pipe) chk(out, 'Components', 'Delivery pressure within the pipeline design pressure', b.pipeP + 2, '≤ ' + cm.pipeline.p.pmax + ' bar', b.pipeP + 2 <= cm.pipeline.p.pmax, 'component', 'bar');
    if (cm.battery && b.batMW > 0 && sys) { const cyc = sys.annual.kpi.bat_cycles * cm.battery.life; chk(out, 'Components', 'Battery cycles over its life', cyc, '≤ ' + cm.battery.p.cycles + ' cycles', cyc <= cm.battery.p.cycles, 'component'); }
    return out;
  };

  /* =====================================================================
     IMPACT ASSESSMENT
     inventory item: { slot, size, capex [MEUR], om [MEUR/a], comp, label?, landM2? }
     perf: model results (see H2.assessChain / H2.assessPlant)
     ===================================================================== */
  const AF = (r, n) => (Math.abs(r) < 1e-9 ? n : (1 - Math.pow(1 + r, -n)) / r);
  function irr(inv, net, n) {
    if (!(net > 0) || !(inv > 0)) return null; const f = r => -inv + net * AF(r, n);
    let lo = -0.9, hi = 1.5; if (f(hi) > 0) return hi; if (f(lo) < 0) return null;
    for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; } return (lo + hi) / 2;
  }
  H2.assess = function (inv, perf, setIn) {
    const set = Object.assign({}, H2.ASSESS_DEFAULTS, setIn || {});
    const reg = own(H2.REGIONS, set.region) || H2.REGIONS.oecd, mult = reg[1];
    const life = perf.life || 25, H2t = Math.max(perf.H2_t || 0, 1e-9);
    const locOf = sp => sp[0] * set.locMfg + sp[1] * set.locInst + sp[2] * set.locOther;
    const rows = [];
    let emb = 0, land = 0, ci = 0, mfg = 0, om = 0, localCapex = 0, pgm = 0, landTot = 0;
    (inv || []).forEach(it => {
      const c = it.comp || H2.libDefault(it.slot, {}); if (!c || !own(CATS, it.slot)) return;
      const q = CATS[it.slot].q(it.size || 0, c);
      const nRep = it.slot === 'stack' ? (perf.stackRepl || 0) : Math.max(0, Math.ceil(life / Math.max(1, c.life) - 1e-9) - 1);
      const e_t = c.emb * q.emb * (1 + nRep) / 1000;
      const l_m2 = it.landM2 != null ? it.landM2 : c.land * q.land;
      const jf = k => { const j = (c.jobs && c.jobs[k]) || [0, 'unit']; const base = j[1] === 'unit' ? q.jobs : j[1] === 'MEUR' ? (it.capexJobs != null ? it.capexJobs : it.capex) : j[1] === 'MWH2' ? (perf.PH2_MW || 0) : j[1] === 'driver' ? (perf.drivers || 0) : 0; return j[0] * base * mult; };
      const r = { slot: it.slot, label: it.label || CATS[it.slot].label, comp: c, size: it.size, unit: CATS[it.slot].size, capex: it.capex || 0, om: it.om || 0, emb_t: e_t, land_m2: l_m2, ci: jf('ci'), mfg: jf('mfg'), omFTE: jf('om'), nRep,
        local: (it.capex || 0) * locOf(c.split), note: it.note || '', outside: !!it.outside };
      if (it.slot === 'wind') landTot += (c.p.landTot || 0) * it.size * 1e4;
      if (it.slot === 'stack') pgm += (c.p.pgm || 0) * it.size * 1000 / 1000;   // g/kW × kW → kg
      rows.push(r); emb += e_t; land += l_m2; ci += r.ci; mfg += r.mfg; om += r.omFTE; localCapex += r.local;
    });
    // other direct costs (civil works, buildings, piping, installation) and indirect costs (engineering, contingency, owner's costs)
    const direct = rows.filter(r => !r.outside).reduce((a, r) => a + r.capex, 0), conv = rows.filter(r => r.outside).reduce((a, r) => a + r.capex, 0);
    const other = Math.max(0, perf.otherDirect || 0), CAPEX = perf.CAPEX_total != null ? perf.CAPEX_total : (direct + other) * 1.2768, indirect = Math.max(0, CAPEX - direct - other);
    const otherSplit = [0.3, 0.6, 0.1];
    const otherEmb = other * 1e6 * SPEND_EF / 1000, otherCI = other * H2.JOBS_GENERIC.ci * mult, otherMfg = other * otherSplit[0] * H2.JOBS_GENERIC.mfg * mult;
    emb += otherEmb; ci += otherCI; mfg += otherMfg; localCapex += other * locOf(otherSplit) + indirect * set.locOther;
    // ---------------- economic
    const opexFix = perf.opexFix != null ? perf.opexFix : rows.reduce((a, r) => a + r.om, 0);
    const running = opexFix + (perf.elec || 0) + (perf.water || 0) + (perf.otherOpex || 0) - (perf.byprod || 0);
    const revenue = H2t * 1000 * set.h2Price / 1e6, net = revenue - running, invest = CAPEX + (perf.stackPV || 0);
    const WACC = perf.WACC != null ? perf.WACC : 0.08;
    const econ = { CAPEX, direct, other, indirect, conv, projectCapex: CAPEX + conv, opexFix, elec: perf.elec || 0, water: perf.water || 0, otherOpex: perf.otherOpex || 0, running, stackPV: perf.stackPV || 0, LCOH: perf.LCOH, LCOP: perf.LCOP,
      revenue, net, NPV: -invest + net * AF(WACC, life), IRR: irr(invest, net, life), payback: net > 0 ? invest / net : null, WACC, life, price: set.h2Price,
      localCapex, localShare: CAPEX + conv > 0 ? localCapex / (CAPEX + conv) : 0, localOM: opexFix * set.locInst, specCapex: perf.P_MW > 0 ? CAPEX * 1000 / perf.P_MW : null };
    // ---------------- environmental
    const ciEmb = emb / (H2t * life);                      // t CO₂e / t H₂ = kg/kg
    const ciGrid = perf.ciGrid || 0, ciTr = perf.ciTr || 0;
    const src = perf.waterSrc || 'fresh', raw = perf.water_m3a || 0;
    const ciOp = ciGrid + ciTr, ciLife = ciOp + ciEmb;
    // classification of the hydrogen: EU RFNBO (operational, no equipment emissions), EU Taxonomy 3.10 (life cycle, 3.0 t/t),
    // US 45V (well-to-gate lifecycle as in GREET – equipment and transport after the gate excluded, here the electricity share)
    const tier45 = ciGrid < 0.45 ? '100 % (< 0.45)' : ciGrid < 1.5 ? '33.4 % (0.45–1.5)' : ciGrid < 2.5 ? '25 % (1.5–2.5)' : ciGrid <= 4 ? '20 % (2.5–4)' : 'not eligible (> 4)';
    const classes = [['EU RFNBO (Delegated Reg. 2023/1185)', ciOp, '≤ 3.38', ciOp <= 3.38], ['EU Taxonomy activity 3.10 (life cycle)', ciLife, '≤ 3.0', ciLife <= 3.0], ['US 45V credit tier (well-to-gate)', ciGrid, tier45, ciGrid <= 4]];
    const env = { emb_t: emb, otherEmb_t: otherEmb, ciEmb, ciGrid, ciTr, ciOp, ciLife, ciModel: perf.CI, classes,
      co2Life_t: (ciGrid + ciTr) * H2t * life + emb, avoided_t: Math.max(0, (10 - (ciGrid + ciTr + ciEmb)) * H2t),     // grey hydrogen (SMR) ≈ 10 kg CO₂e/kg (CM 18.2)
      water_m3a: raw, waterSrc: src, waterInt: raw / H2t, brine_m3a: perf.brine_m3a || 0, land_ha: (land + (perf.plantArea_m2 || 0)) / 1e4, landTot_ha: (land + landTot + (perf.plantArea_m2 || 0)) / 1e4, windArea_ha: landTot / 1e4,
      plantArea_ha: (perf.plantArea_m2 || 0) / 1e4, pgm_kg: pgm, pgmRepl_kg: pgm * (perf.stackRepl || 0) };
    // ---------------- social
    const st = own(H2.STRESS, set.stress) || H2.STRESS.medhigh, fresh = src !== 'sea';
    const risk = src === 'sea' ? 'low' : src === 'brackish' ? (st[2] >= 3 ? 'medium' : 'low') : st[2] >= 3 ? 'high' : st[2] === 2 ? 'medium' : 'low';
    const sf = perf.safety || null; let safety = null;
    if (sf) {
      const maxD = Math.max(sf.lfl || 0, sf.rad || 0, sf.blast || 0), h2t = (sf.inventory_kg || 0) / 1000, nh3t = sf.nh3_t || 0;
      const tier = (q, lo, up) => (q >= up ? 'upper tier' : q >= lo ? 'lower tier' : 'below threshold');
      const ma = H2.majorAccident ? H2.majorAccident({ hydrogen: h2t, ammonia: nh3t }) : null;
      safety = { p: sf.p, lfl: sf.lfl, rad: sf.rad, blast: sf.blast, maxD, boundary: set.dBound, residents: set.dRes, boundaryOK: maxD <= set.dBound, residentsOK: maxD <= set.dRes,
        h2_t: h2t, nh3_t: nh3t, sevesoH2: tier(h2t, 5, 50), sevesoNH3: nh3t > 0 ? tier(nh3t, 50, 200) : null, sevesoSite: ma ? ma.tier : null, sumL: ma ? ma.sumL : null, sumU: ma ? ma.sumU : null, psm: ma ? ma.psm : false, blastMass: sf.blastMass };
    }
    const soc = { mult, region: reg[0], ci_jy: ci, mfg_jy: mfg, mfgLocal_jy: mfg * set.locMfg, ciLocal_jy: ci * set.locInst, om_fte: om, perMW: perf.P_MW > 0 ? { ci: ci / perf.P_MW, om: om / perf.P_MW } : null, perKt: { om: om / (H2t / 1000) },
      localShare: econ.localShare, localCapex, localOM: econ.localOM, freshWater_m3a: fresh ? raw : 0, peopleEq: fresh ? raw / (LPD * 365 / 1000) : 0, stress: st, waterRisk: risk, land_ha: env.land_ha, landTot_ha: env.landTot_ha, safety };
    // ---------------- technical
    const tech = { kpis: perf.kpis || [], checks: perf.checks || [] };
    const notes = [];
    if (perf.noEcon) notes.push('The chain has no Economics & carbon block – CAPEX and LCOH use its default values (WACC 8 %, 25 years).');
    if (perf.otherNote) notes.push(perf.otherNote);
    if (rows.some(r => /PPA/.test(r.note))) notes.push('PV and wind bought through a PPA are counted with their embodied emissions, land and jobs, but not with their CAPEX (it is part of the electricity price).');
    if (conv > 0) notes.push('The ammonia plant (' + conv.toFixed(1) + ' MEUR) is levelised separately as the cost of ammonia (CM 17.6); it is included in local content, jobs, emissions and land.');
    return { set, items: rows, econ, env, soc, tech, notes, H2_t: H2t, P_MW: perf.P_MW || 0, product: perf.product, basis: perf.basis || 'chain' };
  };

  /* ---------------- Model builder chain → assessment ---------------- */
  H2.assessChain = function (res, blocks, set) {
    const s = res.stream; set = Object.assign({}, H2.ASSESS_DEFAULTS, set || {});
    let e = s.econ, noEcon = false; if (!e && s.H2_ta > 0) { e = H2.chainEcon(s, {}); noEcon = true; }
    e = e || { CAPEX: s.capex, other: 0, LCOH: null, WACC: 0.08, life: 25, ciGrid: 0, ciTr: 0, CI: null };
    const k = s.hourly ? s.hourly.kpi : null;
    const inv = s.items.filter(it => it.size > 0 || it.capex > 0);
    const elecCost = (k ? k.elec_MEUR : 0) + (e.downCost || 0), waterCost = s.waterCfg && k ? k.V_raw_m3a * s.waterCfg.price / 1e6 : 0;
    const P = s.ely ? s.ely.P : 0;
    let safety = null;
    if (s.store) { const rel = R('CM-19.1', { d: 3, p: s.store.pmax, T: 20, Cd: 0.85 }), jet = R('CM-19.5', { d: 3, rho0: rel.rho0, m: rel.m / 1000 }), rad = R('CM-19.6', { chi: 0.1, tau: 0.8, m: rel.m / 1000, q: 4.7 }), bm = Math.min(s.store.mtot, H2.BLAST_MASS_MAX), bl = R('CM-19.8', { m: bm, ey: 0.1, R: 30, dp: 10 });
      safety = { p: s.store.pmax, lfl: jet.xLFL, rad: jet.Lf / 2 + rad.r, blast: bl.Rdp, blastMass: bm, inventory_kg: s.store.mtot, nh3_t: s.nh3Tank_t || 0 }; }
    else if (s.nh3Tank_t) safety = { p: 0, lfl: 0, rad: 0, blast: 0, inventory_kg: 0, nh3_t: s.nh3Tank_t };
    const kpis = [];
    if (k) kpis.push(['Hydrogen produced', s.H2_ta, 't/a'], ['Capacity factor', 100 * k.CF, '%'], ['Full-load hours', k.FLH, 'h'], ['Electrolyser SEC (average)', k.SEC_avg, 'kWh/kg'],
      ['Chain electricity per kg H₂', s.E_GWh * 1e6 / Math.max(s.H2_ta * 1000, 1), 'kWh/kg'], ['Chain efficiency (LHV)', 100 * s.H2_ta * H2.C.LHV / 1000 / Math.max(s.E_GWh, 1e-9), '%'], ['Renewable share of electricity', 100 * (1 - (k.E_grid_GWh || 0) / Math.max(k.E_ely_GWh, 1e-9)), '%'], ['Curtailed renewable energy', 100 * k.curt_share, '%'], ['Starts per year', k.starts, '']);
    kpis.push(['Final pressure', s.p_bar, 'bar'], ['Product', s.product || '–', '']);
    if (s.product_ta) kpis.push(['Product output', s.product_ta, s.product === 'electricity' ? 'MWh/a' : 't/a']);
    const perf = { H2_t: s.H2_ta, P_MW: P, PH2_MW: s.ely ? s.ely.PH2_MW : 0, life: e.life, WACC: e.WACC, CAPEX_total: e.CAPEX, otherDirect: e.other, opexFix: Math.max(0, s.opex - elecCost - waterCost - (s.opexCO2 || 0)), elec: elecCost, water: waterCost,
      stackPV: s.stackPV || 0, stackRepl: s.ely ? s.ely.stackRepl : 0, LCOH: e.LCOH, LCOP: e.LCOP, CI: e.CI, ciGrid: e.ciGrid, ciTr: e.ciTr,
      water_m3a: s.water_m3a, waterSrc: s.waterSrc || 'fresh', brine_m3a: s.brine_m3a || 0, drivers: s.drivers || 0, safety, product: s.product, kpis, checks: H2.chainChecks(blocks, Object.assign({}, s, { CI: e.CI }), set), noEcon };
    return H2.assess(inv, perf, set);
  };

  /* ---------------- plant project → inventory and assessment ---------------- */
  H2.assessPlant = function (sys) {
    const b = sys.basis, A = sys.annual.kpi, cap = sys.annual.capex, cm = b.comp || {}, d = sys.design.data;
    const ctx = { tech: b.tech, TDS: b.TDS, islanded: b.supply === 'islanded', p: b.storeP, vmean: b.vmean };
    const get = slot => (cm[slot] ? Object.assign(clone(cm[slot]), { selected: true }) : H2.libDefault(slot, ctx));
    const P = sys.kpi.P, isl = b.supply === 'islanded', inv = [];
    const add = (slot, size, capex, om, extra) => { if (!(size > 0)) return; inv.push(Object.assign({ slot, size, capex, om: om || 0, comp: get(slot) }, extra || {})); };
    const ppa = isl ? null : 'PPA-contracted – CAPEX in the electricity price';
    add('pv', b.pvMWp, cap.PV, cap.PV * (sys.cfg.pv.om_frac || 0), { note: ppa || '' });
    add('wind', b.windMW, cap.Wind, cap.Wind * (sys.cfg.wind.om_frac || 0), { note: ppa || '' });
    if (b.batMWh > 0) add('battery', b.batMW, cap.Battery, cap.Battery * (sys.cfg.battery.om_frac || 0));
    // electrolyser CAPEX split: the stack share of the design basis (as in the LCOH), the rest between power electronics and balance of plant
    const S = get('stack'), PS = get('psu'), BO = get('bop'), sf = clamp(num(b.stackFrac, 0.3), 0, 0.95), pb = Math.max(1e-9, PS.capex + BO.capex), elC = cap.Electrolyser;
    add('stack', P, elC * sf, 0, { landM2: 0 }); add('psu', P, elC * (1 - sf) * PS.capex / pb, 0); add('bop', P, elC * (1 - sf) * BO.capex / pb, 0);
    // equipment inside the "other direct costs" of the basis, costed with the unit costs of the components
    const within = [];
    const addW = (slot, size, extra) => { if (!(size > 0)) return; const c = get(slot); const q = CATS[slot].q(size, c); within.push(Object.assign({ slot, size, capex: c.capex * q.capex / 1e6, comp: c }, extra || {})); };
    addW('water', sys.water.raw * 24);
    addW('compressor', sys.compTrain.P);
    if (sys.endUse.pipe) addW('pipeline', sys.endUse.pipe.L);
    if (sys.endUse.trailer) addW('trailer', sys.endUse.trailer.N);
    if (b.deliver === 'hrs' && b.product !== 'NH3') addW('hrs', b.demand / 1000);
    if (b.product === 'NH3') { const c = get('ammonia'), cx = b.demand * c.capex / 1e6; inv.push({ slot: 'ammonia', size: b.demand, capex: cx, om: cx * c.om, comp: c, outside: true, note: 'conversion plant – levelised separately (CM 17.6), not in the LCOH' }); }
    const wSum = within.reduce((a, x) => a + x.capex, 0), other = Math.max(0, cap.Other || 0);
    let scale = 1, otherNote = '';
    if (wSum > other && wSum > 0) { scale = other / wSum; otherNote = 'The component unit costs of water plant, compression and delivery (' + wSum.toFixed(1) + ' MEUR) exceed the other direct costs of the design basis (' + other.toFixed(1) + ' MEUR); they are scaled to fit. Raise “Other direct costs (× electrolyser)” to about ' + ((cap.Electrolyser > 0 ? (wSum * 1.25 + cap.Battery + cap.Storage) / cap.Electrolyser : 0)).toFixed(2) + ' to include them in full.'; }
    within.forEach(x => { x.capexJobs = x.capex; x.capex *= scale; x.om = x.capex * x.comp.om; inv.push(x); });
    const storeUsable = b.storeSizing === 'hourly' ? A.buffer_t * 1000 : d.m_st;
    add('storage', storeUsable, cap.Storage, cap.Storage * get('storage').om);
    const rest = Math.max(0, other - wSum * scale);
    const vol = R('DM-13.1', { mu: Math.max(storeUsable, 1), pmax: b.storeP, pmin: b.storePmin, T: 25 });
    const L = sys.layout;
    const trips = sys.endUse.trailer ? sys.endUse.trailer.n : 0;
    const kpis = [['Hydrogen produced', A.H2_t, 't/a'], ['Capacity factor', 100 * A.CF, '%'], ['Full-load hours', A.FLH, 'h'], ['Electrolyser SEC (average)', A.SEC_avg, 'kWh/kg'],
      ['Plant electricity per kg H₂', (A.E_ely_GWh + A.E_aux_GWh) * 1e6 / Math.max(A.H2_t * 1000, 1), 'kWh/kg'], ['Plant efficiency (LHV)', 100 * A.H2_t * H2.C.LHV / 1000 / Math.max(A.E_ely_GWh + A.E_aux_GWh, 1e-9), '%'],
      ['Renewable share of electricity', 100 * (1 - A.E_grid_GWh / Math.max(A.E_ely_GWh + A.E_aux_GWh, 1e-9)), '%'], ['Curtailed renewable energy', 100 * A.curt_share, '%'], ['Starts per year', A.starts, '']];
    const perf = { H2_t: A.H2_t, P_MW: P, PH2_MW: sys.kpi.mProd * H2.C.LHV / 1000, life: b.life, WACC: b.WACC, CAPEX_total: A.CAPEX_MEUR, otherDirect: rest, opexFix: A.opex_MEUR, elec: A.elec_MEUR, water: A.water_MEUR, otherOpex: A.heat_MEUR || 0,
      stackPV: A.PVstacks_MEUR + (A.PVrepl_MEUR || 0), stackRepl: A.stack_replacements, LCOH: A.LCOH, CI: A.CI_kgkg, ciGrid: A.CI_kgkg, ciTr: 0,
      water_m3a: A.V_raw_m3a, waterSrc: cm.water ? cm.water.p.src : (b.TDS > 10 ? 'sea' : b.TDS > 2 ? 'brackish' : 'fresh'), brine_m3a: Math.max(0, A.V_raw_m3a - A.V_DI_m3a), plantArea_m2: L.siteW * L.siteH,
      drivers: trips * 6 * 365 / (8 * 220), safety: { p: b.storeP, lfl: L.jet.xLFL, rad: L.radC != null ? L.radC : L.rad.r, blast: L.blast.Rdp, blastMass: Math.min(vol.mtot, H2.BLAST_MASS_MAX), inventory_kg: sys.seveso ? sys.seveso.h2_t * 1000 : vol.mtot, nh3_t: sys.endUse.tankT || 0 },
      product: b.product === 'NH3' ? 'NH₃' : 'H₂', kpis, checks: sys.checks, otherNote, basis: 'plant' };
    const set = {}; Object.keys(H2.ASSESS_DEFAULTS).forEach(k => { if (b[k] != null) set[k] = b[k]; });
    return H2.assess(inv, perf, set);
  };
})(typeof window !== 'undefined' ? window : globalThis);

;
/* Hasim – Green Hydrogen Engineering Suite. © 2026 Prof. Hani Muhsen. All rights reserved. */
/* Hasim – validation suite: worked examples of both manuals reproduced
   with the equation library.  tol = relative tolerance (manual rounding). */
(function (root) {
  'use strict';
  const T = root.H2.TESTS = [
    // ---------------- Calculations Manual ----------------
    ['CM Ex 1.1', 'Mass flow from 500 Nm³/h', 'CM-1.1', { VN: 500 }, { m: 44.97, m_td: 1.079 }],
    ['CM Ex 1.1', 'Energy content of 44.97 kg/h', 'CM-1.2', { m: 44.97 }, { E_LHV: 1498, E_HHV: 1772 }],
    ['CM Ex 1.2', '20 MW at CF 45 %, 53 kWh/kg', 'CM-1.3', { P: 20000, SEC: 53 }, { mdot: 377 }],
    ['CM Ex 1.2', 'Annual production', 'CM-1.4', { P: 20000, CF: 0.45, SEC: 53 }, { E: 78840, m: 1488, NH3: 8360 }],
    ['CM Ex 2.1', 'Wet H₂ at 1.05 bar, 70 °C', 'CM-2.1', { p: 1.05, T: 70, V: 620 }, { rho: 0.0742, m: 46.0, VN: 511 }],
    ['CM Ex 2.2', '50 L tank at 700 bar, 15 °C', 'CM-2.5', { V: 0.05, p: 700, T: 15 }, { m: 2.03, m_id: 2.94 }],
    ['CM Ex 2.2', 'Compressibility at 700 bar', 'CM-2.4', { p: 700, T: 15 }, { Z: 1.453 }],
    ['CM Ex 3.1', 'ΔG, E_rev, E_tn at 25 °C', 'CM-3.2', { dH: 285.83, dS: 163.31, T: 298.15 }, { dG: 237.14, Erev: 1.2289, Etn: 1.4812, fel: 0.83 }],
    ['CM Ex 3.2', 'E_rev at 80 °C (LeRoy)', 'CM-3.5', { T: 80 }, { Erev: 1.1834 }],
    ['CM Ex 3.3', 'Nernst penalty 30/30 bar', 'CM-3.6', { T: 80, pH2: 30, pO2: 30, a: 1 }, { dE: 0.0776 }],
    ['CM Ex 3.3', 'Nernst penalty 30/1 bar', 'CM-3.6', { T: 80, pH2: 30, pO2: 1, a: 1 }, { dE: 0.0518 }],
    ['CM Ex 3.4', 'Efficiencies at 1.9 V', 'CM-3.8', { E: 1.9, T: 80 }, { eHHV: 0.779, eLHV: 0.659, eG: 0.623, SEC: 50.5 }],
    ['CM Ex 3.5', 'Heat of a 1 MW stack', 'CM-3.10', { P: 1000, E: 1.9, Etn: 1.472, fgas: 0.1, dT: 10 }, { Q: 225, mcw: 4.84, Vcw: 17.4 }, 0.03],
    ['CM Ex 3.6', 'SOEC energy split at 1.1 V', 'CM-3.12', { E: 1.1, Etn: 1.287 }, { wel: 29.2, q: 5.0, tot: 34.2 }],
    ['CM Ex 4.1', "Faraday's law, 100 cells, 5 kA", 'CM-4.2', { N: 100, I: 5000, etaF: 0.985 }, { mH2: 18.5, VN: 206, mO2: 147, mH2O: 165 }],
    ['CM Ex 4.2', 'Anode η at 1 A/cm²', 'CM-4.5', { T: 80, j: 1, j0: 2e-7, alpha: 1.5 }, { RTaF: 0.02029, eta: 0.313, b: 46.7 }],
    ['CM Ex 4.2', 'Anode η at 2 A/cm²', 'CM-4.5', { T: 80, j: 2, j0: 2e-7, alpha: 1.5 }, { eta: 0.327 }],
    ['CM Ex 4.2', 'Cathode η at 1 A/cm²', 'CM-4.5', { T: 80, j: 1, j0: 1e-2, alpha: 1.5 }, { eta: 0.093 }],
    ['CM Ex 4.3', 'Nafion 117 conductivity & ASR', 'CM-4.8', { lambda: 22, T: 80, delta: 183 }, { sigma: 0.199, ASR: 0.092 }],
    ['CM Ex 4.3', 'Nafion 212 ASR', 'CM-4.8', { lambda: 22, T: 80, delta: 50 }, { ASR: 0.025 }, 0.04],
    ['CM Ex 4.4', 'Bubble effect ε = 0.2', 'CM-4.9', { sigma: 1.2, eps: 0.2, gap: 0.1 }, { seff: 0.859, R: 0.116 }],
    ['CM Ex 4.5', 'PEM cell at 2 A/cm²', 'CM-4.4', { T: 80, pH2: 1, pO2: 1, j: 2, j0a: 2e-7, j0c: 1e-2, alpha: 1.5, ASR: 0.15, jlim: 0 }, { E: 1.918, SEC: 51.0, eHHV: 0.772 }],
    ['CM Ex 4.5', 'PEM cell, ASR halved', 'CM-4.4', { T: 80, pH2: 1, pO2: 1, j: 2, j0a: 2e-7, j0c: 1e-2, alpha: 1.5, ASR: 0.075, jlim: 0 }, { E: 1.768, SEC: 47.0 }],
    ['CM Ex 4.6', 'Alkaline cell at 0.2 A/cm²', 'CM-4.4', { T: 80, pH2: 1, pO2: 1, j: 0.2, j0a: 1e-6, j0c: 3e-4, alpha: 1, ASR: 0.35, jlim: 0 }, { ea: 0.371, ec: 0.198, E: 1.822, SEC: 48.5 }],
    ['CM Ex 4.6', 'Alkaline cell at 0.4 A/cm²', 'CM-4.4', { T: 80, pH2: 1, pO2: 1, j: 0.4, j0a: 1e-6, j0c: 3e-4, alpha: 1, ASR: 0.35, jlim: 0 }, { E: 1.935, SEC: 51.4 }],
    ['CM Ex 4.6', 'Alkaline cell at 0.8 A/cm²', 'CM-4.4', { T: 80, pH2: 1, pO2: 1, j: 0.8, j0a: 1e-6, j0c: 3e-4, alpha: 1, ASR: 0.35, jlim: 0 }, { E: 2.117, SEC: 56.3 }],
    ['CM Ex 5.1', 'Iridium for 1 GW PEM', 'CM-5.1', { P: 1000, j: 2, E: 1.85, L: 1.5 }, { A: 27000, mcat: 405, spec: 0.41 }],
    ['CM Ex 6.1', '5 MW PEM module', 'CM-6.1', { A: 1500, j: 2, E: 1.85, N: 150, etaF: 0.99, Pmod: 5000 }, { I: 3000, V: 277.5, P: 832.5, mdot: 16.8, Nst: 6, SEC: 49.7 }],
    ['CM Ex 6.2', 'Rectifier & transformer', 'CM-6.3', { PDC: 5000, eta: 0.97, k: 0.15, cosphi: 0.93 }, { PAC: 5155, loss: 155, S: 6375 }],
    ['CM Ex 6.4', 'Degradation to end of life', 'CM-6.6', { E0: 1.85, rd: 5, f: 0.1, h: 8000, etaF: 0.99 }, { tEoL: 37000, tEoL_a: 4.6, EEoL: 2.035, SEC0: 49.7, SEC1: 54.7, SECavg: 52.2 }],
    ['CM Ex 7.2', 'Cross-over at 2 A/cm² (saturated diffusion only)', 'CM-7.6', { Psi: 2e-11, kappa: 0, dp: 30, delta: 0.0183, j: 2, lye: 0 }, { n: 3.28e-8, jx: 0.0063, etaF: 0.997 }],
    ['CM Ex 7.2', 'Cross-over at 0.2 A/cm² (saturated diffusion only)', 'CM-7.6', { Psi: 2e-11, kappa: 0, dp: 30, delta: 0.0183, j: 0.2, lye: 0 }, { etaF: 0.968 }],
    ['CM Ex 7.2', 'H₂ in O₂ at 0.5 A/cm²', 'CM-7.7', { n: 3.28e-8, j: 0.5 }, { x: 0.025, jmin: 0.62 }],
    ['CM Ex 7.3', 'Full load system SEC', 'CM-7.8', { Pn: 1000, L: 1, E: 1.918, er: 0.96, Pf: 30, k: 0.02, etaF: 1 }, { SECst: 51.0, mdot: 19.6, SEC: 55.7 }],
    ['CM Ex 7.3', '30 % load system SEC', 'CM-7.8', { Pn: 1000, L: 0.3, E: 1.66, er: 0.96, Pf: 30, k: 0.02, etaF: 1 }, { SECst: 44.1, mdot: 6.8, SEC: 51.2 }],
    ['CM Ex 8.2', 'Water for 100 MW at CF 0.5', 'CM-8.1', { m: 8420, w: 0.4, Y: 0.65, mc: 0, eRO: 3 }, { DI: 78600, raw: 121000, ERO: 363 }],
    ['CM Ex 8.4', 'Moisture at 80 °C, 30 bar', 'CM-8.3', { T: 80, p: 30, m: 1000 }, { w: 0.1431 }],
    ['CM Ex 8.4', 'Moisture at 30 °C, 30 bar', 'CM-8.3', { T: 30, p: 30, m: 1000 }, { w: 0.0126 }],
    ['CM Ex 9.1', 'Buffer 26 m³, 250→25 bar', 'CM-9.1', { V: 26, pmax: 250, pmin: 25, T: 15, NWP: 250 }, { mstored: 471, mres: 54, musable: 417 }],
    ['CM Ex 9.1', 'Trailer 40 m³, 500→30 bar', 'CM-9.1', { V: 40, pmax: 500, pmin: 30, T: 15, NWP: 500 }, { mstored: 1272, mres: 99, musable: 1173 }],
    ['CM Ex 9.2', 'Type I vessel wall', 'CM-9.3', { pd: 45, pw: 30, Di: 0.23, f: 300, z: 1 }, { t: 18.6, sig: 185 }],
    ['CM Ex 9.4', 'Cascade bank 950/720 bar', 'CM-9.4', { pb: 950, peq: 720, T: 15, m: 48 }, { dr: 8.2, V: 5.9 }],
    ['CM Ex 10.1', 'Isothermal 1→350 bar', 'CM-10.1', { p1: 1, p2: 350, T1: 25, Zm: 1 }, { wMJ: 7.2, w: 2.0, fLHV: 0.06 }],
    ['CM Ex 10.1', 'Isentropic single stage 1→350 bar', 'CM-10.2', { p1: 1, p2: 350, T1: 25, Zm: 1, gamma: 1.405 }, { w: 5.23, T2: 1610 }],
    ['CM Ex 10.3', '3-stage 30→200 bar, 1923 kg/h', 'CM-10.4', { p1: 30, p2: 200, N: 3, rmax: 2.3, T1: 25, Zm: 1.06, es: 0.75, em: 0.9, m: 1923 }, { r: 1.88, wid: 0.75, SEC: 1.11, T2: 104, P: 2130 }],
    ['CM Ex 10.2', 'Electrical power 4-stage', 'CM-10.5', { m: 60, w: 1.58, es: 0.72, em: 0.95, emot: 0.94 }, { SEC: 2.45, P: 147, Q: 132 }],
    ['CM Ex 10.4', 'Electrochemical compressor', 'CM-10.6', { T: 60, p1: 1, p2: 700, j: 1, ASR: 0.2 }, { Erev: 0.094, E: 0.294, SEC0: 2.5, SEC: 7.8 }],
    ['CM Ex 11.1', '100 t/d liquefier', 'CM-11.1', { T0: 300, ds: 53.5, dh: 2000, SEC: 9, m: 100 }, { P: 37.5, eex: 0.43, fLHV: 0.27 }],
    ['CM Ex 11.2', '300 m³ sphere BOR', 'CM-11.2', { V: 300, q: 1.5, fill: 1, dh: 445.6 }, { A: 217, Q: 325, BOR: 0.3, loss: 63 }],
    ['CM Ex 11.2', '10 000 m³ sphere BOR', 'CM-11.2', { V: 10000, q: 1.5, fill: 1, dh: 445.6 }, { A: 2245, BOR: 0.092, loss: 650 }],
    ['CM Ex 12.1', 'Hydride plateau at 60 °C', 'CM-12.1', { dH: -30800, dS: -108, T: 60 }, { lnp: 1.87, p: 6.5 }],
    ['CM Ex 12.1', 'Hydride plateau at 80 °C', 'CM-12.1', { dH: -30800, dS: -108, T: 80 }, { p: 12.2 }],
    ['CM Ex 12.4', 'Salt cavern 500 000 m³', 'CM-12.6', { V: 500000, pmax: 180, pmin: 60, T: 40, fill: 1923 }, { mmax: 6294, mcush: 2243, mw: 4051, E: 135, tfill: 88 }],
    ['CM Ex 13.1', 'DN400 pipeline, 100 km', 'CM-13.1', { L: 100, D: 0.4, f: 0.013, Zm: 1.04, T: 15, p1: 70, p2: 50 }, { m: 9.7, P: 1160, u1: 13.7, u2: 18.9 }],
    ['CM Ex 13.3', 'Tube trailers 1000 kg', 'CM-13.3', { m: 5000, mu: 1000, d: 200, cyc: 10, c: 35, LHVd: 35.6, CO2: 2.65 }, { trips: 5, e: 5.0, co2: 0.37 }],
    ['CM Ex 13.3', 'Steel trailers 330 kg', 'CM-13.3', { m: 5000, mu: 330, d: 200, cyc: 10, c: 35, LHVd: 35.6, CO2: 2.65 }, { trips: 16, e: 15.1, frac: 0.126, co2: 1.12 }],
    ['CM Ex 15.1', 'Ammonia from 100 MW', 'CM-15.2', { mNH3: 9.75, eASU: 0.12, eloop: 0.55, SEC: 52 }, { mN2: 8.0, PASU: 0.96, E: 9.9, eta: 0.52 }],
    ['CM Ex 15.2', 'Methanol from 1 t/h H₂', 'CM-15.5', { mH2: 1000, SEC: 52, ecap: 0.5, esyn: 0.6 }, { mMeOH: 5300, mCO2: 7280, mH2O: 2980, Q: 2.3, E: 11.1, eta: 0.5 }],
    ['CM Ex 16.1', '100 kW PEM fuel cell', 'CM-16.2', { V: 0.7, ef: 0.98, P: 100, kBoP: 0.12, j: 1, A: 300 }, { eta: 0.547, etas: 0.482, N: 476, I: 300, m: 5.48 }],
    ['CM Ex 16.5', '20 % H₂ in methane', 'CM-16.5', { x: 0.2, HHVg: 39.82, dg: 0.554 }, { HHV: 34.4, d: 0.457, W: 50.9, share: 0.074, flow: 1.157 }],
    ['CM Ex 17.1', 'Reference LCOH', 'CM-17.3', { Cinv: 1500, r: 0.07, n: 25, fOM: 0.03, CF: 0.5, SEC: 52, sf: 0.35, sl: 80000, pel: 50, cw: 0.05 }, { CRF: 0.0858, mkW: 84.2, Cst: 28.7, cap: 2.4, el: 2.6, LCOH: 5.05 }],
    ['CM Ex 17.3', 'NPV and IRR', 'CM-17.5', { I0: 150, m: 8423, price: 6, E: 438, pel: 50, OM: 4.5, r: 0.07, n: 25 }, { CFa: 24.1, pb: 6.2 }],
    ['CM Ex 17.4', 'Levelised cost of ammonia', 'CM-17.6', { LCOH: 5, Csyn: 1000, CRF: 0.0858, fOM: 0.03, CF: 1, esyn: 0.65, pel: 50 }, { h: 888, cap: 116, el: 33, LCOA: 1037 }],
    ['CM Ex 17.5', 'Learning curve to 160 GW', 'CM-17.8', { C0: 1500, Q0: 10, Q: 160, LR: 0.18 }, { b: -0.286, C: 680 }],
    ['CM Ex 18.1', 'CI with 250 g/kWh grid', 'CM-18.1', { CIel: 250, SEC: 52, emb: 0.1, thr: 3.38 }, { CI: 13.1, CImax: 63 }],
    ['CM Ex 18.1', 'CI with wind (12 g/kWh), 45V tier', 'CM-18.1', { CIel: 12, SEC: 52, emb: 0.1, thr: 0.45 }, { CI: 0.72, CImax: 6.7 }],
    ['CM Ex 18.2', 'Abatement cost', 'CM-18.2', { Lg: 5.05, Lr: 1.82, CIr: 9.5, CIg: 1, m: 8423 }, { c: 380, dCO2: 71600 }],
    ['CM Ex 18.3', 'Leakage 3 %', 'CM-18.3', { l: 0.03, GWP: 11.6, CI: 1 }, { leak: 0.36, tot: 1.39 }],
    ['CM Ex 19.1', '1 mm leak at 700 bar', 'CM-19.1', { d: 1, p: 700, T: 20, Cd: 0.85 }, { rho0: 40.2, m: 24.2 }],
    ['CM Ex 19.1', 'Blow-down of 150 L tank', 'CM-19.2', { V: 0.15, p: 700, T: 20, m0dot: 24.2, pend: 2 }, { m0: 6.0, tau: 248 }],
    ['CM Ex 19.2', 'Ventilation for 1 g/s leak', 'CM-19.3', { m: 1, rho: 0.082, x: 0.01, V: 65 }, { Q: 1.22, Qh: 4400, ACH: 68 }],
    ['CM Ex 19.3', 'Jet 1 mm hole', 'CM-19.5', { d: 1, rho0: 40.2, m: 0.0242 }, { deff: 17.4, xLFL: 8.5, Lf: 1.9 }],
    ['CM Ex 19.3', 'Jet 3 mm hole', 'CM-19.5', { d: 3, rho0: 40.2, m: 0.218 }, { deff: 52, xLFL: 26, Lf: 6.0 }],
    ['CM Ex 19.4', 'Radiation 4.7 kW/m²', 'CM-19.6', { chi: 0.1, tau: 0.8, m: 0.0242, q: 4.7 }, { Prad: 290, r: 2.0 }, 0.26],
    ['CM Ex 19.5', 'TNT equivalence, 10 kPa', 'CM-19.8', { m: 5, ey: 0.1, R: 30, dp: 10 }, { W: 12.8, Rdp: 30 }],
    ['CM Ex 19.5', 'TNT equivalence, 2 kPa', 'CM-19.8', { m: 5, ey: 0.1, R: 118, dp: 2 }, { Rdp: 118 }],
    ['CM Ex 19.6', 'Relief valve API 520', 'CM-19.9', { W: 3600, P1: 44100, Kd: 0.975, T: 300, Z: 1.27, M: 2.016 }, { A: 42.6, d: 7.4 }],
    ['CM Ex 20.1', 'B31.12 wall, H₂ service', 'CM-20.1', { p: 7, D: 400, S: 359, F: 0.5, E: 1, T: 1, Hf: 0.874 }, { t: 8.9, steel: 88 }],
    ['CM Ex 20.1', 'Natural-gas design factor', 'CM-20.1', { p: 7, D: 400, S: 359, F: 0.72, E: 1, T: 1, Hf: 1 }, { t: 5.4, steel: 53 }],
    ['CM Ex 20.2', 'Permeation through pipe wall', 'CM-20.2', { Phi: 1e-11, p1: 7, p2: 0, d: 10, D: 0.4 }, { J: 2.6e-9, loss: 0.21 }],
    // ---------------- Plant Design Manual ----------------
    ['DM Ex 1.2', 'Case B sizing chain', 'DM-1.1–1.5', { mprod: 45000, yield: 0.178 / 0.97, avail: 0.983, SEC: 52, FLH: 4400, c: 0.15, FLHRE: 2600, aux: 6, wDI: 10.5, Y: 0.38 }, { mH2: 8400, Pely: 99.3, mdot: 1910 }, 0.03],
    ['DM Ex 2.2', 'Pressurised stack penalty', 'DM-2.1', { T: 80, pH2: 30, pO2: 30, dcross: 0, wmech: 1.7 }, { dE: 0.078, dSEC: 2.06 }],
    ['DM Ex 2.4', 'Availability of 10 subsystems', 'DM-2.3', { A: '0.997,0.99,0.99,0.97,0.97,0.985,0.995,0.96,0.96,0.998', Au: 0.96, MTBF: 4000, MTTR: 48 }, { Asys: 0.828 }],
    ['DM Ex 3.1', 'P90 of Case A PV', 'DM-3.1', { E: 32.3, si: 0.045, sd: 0.035, sm: 0.03, z: 1.282 }, { s: 0.064, P90: 29.6 }],
    ['DM Ex 3.2', 'Layout of 180 MWp', 'DM-3.4', { P: 180, Pm: 620, Voc: 50.5, beta: -0.0025, Tmin: 2, Vmax: 1500, r: 1.25, S: 4.2, amod: 4.55, GCR: 0.38, finfra: 0.15 }, { Nmod: 290323, VocT: 53.4, ns: 28, Nstr: 10369, Ninv: 35, land: 248 }],
    ['DM Ex 3.4', 'Optimum cleaning interval', 'DM-3.5', { c: 0.15, s: 0.004, Ed: 6, v: 0.0375 }, { N: 18, l: 0.036 }],
    ['DM Ex 4.1', 'Shear and Weibull', 'DM-4.1', { v1: 6.1, z1: 10, v2: 8.6, z2: 100, zh: 110, k: 2.2 }, { alpha: 0.149, vh: 8.72, G: 0.8856 }],
    ['DM Ex 4.1', 'Net wind CF', 'DM-4.2', { CFg: 0.456, lw: 0.07, la: 0.03, le: 0.02, lenv: 0.01, P: 60 }, { CF: 0.4, FLH: 3500 }, 0.03],
    ['DM Ex 5.1', 'Thyristor rectifier of a 5 MW module', 'DM-5.1', { N: 230, E: 1.85, P: 4.8, VLL: 360, dVx: 0.05, eta: 0.98, m: 0.08 }, { Vdc: 425, Idc: 11.3, Vdc0: 486, cosphi: 0.88, ST: 6.0 }],
    ['DM Ex 5.2', 'DC busbar', 'DM-5.3', { I: 11300, j: 1.6, rho: 2.1e-8, L: 20, Asel: 7200 }, { Areq: 7060, R: 58, P: 7.4, dV: 0.66 }],
    ['DM Ex 5.3', 'Grid short-circuit, Case A', 'DM-5.4', { Ssc: 250, V: 20, ST: 6.3, Vs: 0.36, uk: 0.08, Smax: 13.5 }, { Isc: 7.217, IL: 390, SCR: 18.5 }],
    ['DM Ex 6.1', 'Case A water demand', 'DM-6.1', { m: 182, w: 10, Y1: 0.8, Y2: 1, cool: 0, other: 0 }, { DI: 1.82, raw: 2.27, brine: 0.45 }],
    ['DM Ex 6.2', 'Case B two-pass recovery', 'DM-6.1', { m: 1923, w: 10.5, Y1: 0.42, Y2: 0.9, cool: 0, other: 0 }, { DI: 20.2, Y: 0.395, raw: 51 }],
    ['DM Ex 6.2', 'Evaporative alternative', 'DM-9.4', { Q: 30.8, hfg: 2450, COC: 4, drift: 0 }, { ev: 45.2, bd: 15.1, mk: 60.3 }],
    ['DM Ex 7.1', 'Well drawdown', 'DM-7.1', { Q: 200, T: 200, R: 500, rw: 0.15, rech: 15, A: 60 }, { s: 1.3, rec: 900000 }],
    ['DM Ex 7.3', 'Rainwater Case A roofs', 'DM-7.2', { A: 10000, h: 700, cr: 0.85, ff: 0.05, n: 80 }, { V: 5650 }],
    ['DM Ex 8.1', 'Gypsum saturation', 'DM-8.7', { CF: 4, TDS: 19600, Ca: 150, SO4: 900, Ksp: 2.5e-5 }, { I: 0.49, g: 0.289, S: 1.87 }],
    ['DM Ex 8.1', 'Langelier index', 'DM-8.6', { TDS: 20000, T: 301, Ca: 1500, Alk: 820, pH: 7.9 }, { A: 0.33, C: 2.78, D: 2.91, LSI: 1.9 }],
    ['DM Ex 8.2', 'SWRO energy with ERD', 'DM-8.4', { pf: 64.4, ep: 0.8, Y: 0.42, eERD: 0.96, pb: 62.9, dpl: 1.5 }, { s0: 5.32, s1: 2.47 }],
    ['DM Ex 8.3', 'Fresh-water RO at 15 °C', 'DM-8.3', { A: 3, T: 14.85, pf: 10.8, dpl: 0, CP: 1, pifc: 1.7, pip: 0, Qp: 163, Ael: 40.9 }, { TCF: 0.735, NDP: 9.1 }],
    ['DM Ex 8.4', 'Brine diffuser dilution', 'DM-8.8', { cb: 68, ca: 41, dc: 1.5, rb: 1045, ra: 1025, u0: 4, d0: 0.04 }, { Sreq: 18, gp: 0.19, Fr: 46, Sr: 73 }],
    ['DM Ex 9.1', 'Dry cooler Case B', 'DM-9.2', { Q: 26.4, Tci: 80, Tco: 70, Tai: 45, Tao: 60, U: 30, fan: 415 }, { dTlm: 22.4, A: 39300, Vair: 1590, Pfan: 660 }],
    ['DM Ex 10.3', 'Lye circulation', 'DM-10.1', { Q: 1.32, rho: 1290, cp: 3, dT: 10, K: 0.05, rG: 2, V: 120 }, { Vl: 123, u: 1.27, mKOH: 46 }],
    ['DM Ex 10.5', 'Minimum load from HTO', 'DM-10.2', { j1: 0.6, h1: 0.67, j2: 0.3, h2: 1.13, alarm: 1.5, trip: 2, jn: 0.6 }, { a: 0.207, b: 0.276, ja: 0.215, jt: 0.156 }, 0.04],
    ['DM Ex 11.1', 'SIL of the H₂-in-O₂ trip', 'DM-11.1', { fi: 0.1, pfd: '0.1', ft: 1e-5, lam: 5e-7 }, { fm: 0.01, PFD: 0.001, SIL: 3, Tp: 4000 }],
    ['DM Ex 11.2', 'Ventilation of the stack hall', 'DM-11.2', { A: 6000, m: 0.001, k: 0.5, cL: 0.00335, T: 293, f: 3, Vroom: 60000, ach: 5 }, { VN: 30.5, VI: 0.6 }],
    ['DM Ex 12.1', 'Case A compressor stages', 'DM-12.1', { p1: 30, p2: 250, rmax: 2.3, T1: 35, es: 0.75, em: 0.92, m: 182 }, { N: 3, r: 2.03 }],
    ['DM Ex 13.2', 'Case A buffer volume', 'DM-13.1', { mu: 3000, pmax: 250, pmin: 35, T: 25 }, { V: 198 }],
    ['DM Ex 13.3', 'Vessel walls 22 MPa', 'DM-13.3', { P: 22, D: 1000, S1: 138, S2: 200, E: 1, Rp: 355, Rm: 490, c: 1 }, { t1: 89, t2: 59, f: 204, e: 58 }],
    ['DM Ex 14.1', 'Customer pipeline wall', 'DM-14.2', { P: 3.3, D: 88.9, S: 359, F: 0.5, Hf: 0.874, fd: 0.5 }, { tA: 0.93 }],
    ['DM Ex 15.1', 'Loop heat', 'DM-15.3', { mNH3: 6.81, eta: 0.97, eASU: 0.12, wH2: 1, wN2: 0.14, eloop: 0.12 }, { Q: 5.1 }],
    ['DM Ex 16.1', 'Station sizing', 'DM-16.1', { m: 500, fp: 0.12, top: 20, mg: 0.25, nb: 6, mf: 5, tb: 0.5, cp: 14.3, Tin: 25, Tout: -40, COP: 1.2 }, { peak: 60, comp: 31, Epc: 0.22 }],
    ['DM Eq 16.3', 'Hot-fill end pressure 85 °C', 'DM-16.3', { NWP: 700, T: 85 }, { rho: 40.5, p: 870 }],
    ['DM Ex 17.2', 'Blend 10 % H₂', 'DM-17.2', null, null],
    ['DM Ex 18.1', 'Flange leak 9.1 mm at 200 bar', 'CM-19.5', { d: 9.1, rho0: 14.5, m: 0.64 }, { deff: 95, xLFL: 47, Lf: 13 }],
    ['DM Ex 20.1', 'LCOH of Case A', 'DM-20.2', { CAPEX: 35.2, r: 0.07, n: 25, st: 0, sy: 12, fix: 1.56 + 0.25, E: 66.6, pel: 80, cw: 0, by: 0, m: 1090, target: 6 }, { CRF: 0.0858, tot: 10.16, LCOH: 9.3 }],
  ].filter(t => t[3]);
  // blend example uses CM-16.5 with natural gas of the design manual
  T.push(['DM Ex 17.2', 'Blend 10 % H₂ in natural gas', 'CM-16.5', { x: 0.1, HHVg: 39.8, dg: 0.58 }, { HHV: 37.1, d: 0.529, W: 51.0, share: 0.034 }]);

  root.H2.validate = function () {
    const res = [];
    T.forEach(t => {
      const [src, title, id, inp, exp, tol] = t; const tl = tol || 0.025;
      let out = null, err = null;
      try { out = root.H2.run(id, inp); } catch (e) { err = e.message; }
      Object.keys(exp).forEach(k => {
        const got = out ? out[k] : NaN; const want = exp[k];
        const rel = Math.abs(got - want) / Math.max(Math.abs(want), 1e-12);
        res.push({ src, title, id, key: k, want, got, rel, pass: !err && rel <= tl, err });
      });
    });
    return res;
  };
})(typeof window !== 'undefined' ? window : globalThis);

;
/* Hasim – Green Hydrogen Engineering Suite. © 2026 Prof. Hani Muhsen. All rights reserved. */
/* =====================================================================
   Hasim – engine-pool.js (Hasim 3.0)
   Parallel solves: a pool of worker threads that each load the headless
   engine bundle (hasim-engine.js) and answer batched requests.
     browser / Electron : Web Workers (new Worker(url of the bundle))
     Node                : worker_threads (new Worker(path of the bundle))
   When the bundle itself runs inside a worker, this file registers the
   message handler, so the same file serves both sides.
   Functions a pool can run (by name, because functions do not cross threads):
     'summary'  basis            -> H2.summary(H2.solveSystem(basis))   compact KPIs and checks (optimiser, Monte Carlo)
     'solve'    basis            -> H2.solveSystem(basis)               the complete system (large; structured clone)
     'hourly'   basis            -> H2.hourly(H2.hourlyFromBasis(basis))
     'run'      [id, inputs]     -> H2.run(id, inputs)                   one equation
     any name registered with H2.pool.define(name, fn) in the bundle (the optimiser and Monte Carlo add theirs)
   Author and owner: Prof. Hani Muhsen.
   ===================================================================== */
(function (root) {
  'use strict';
  const H2 = root.H2 || (root.H2 = {});
  const isNode = typeof process !== 'undefined' && !!(process.versions && process.versions.node);
  const nodeWT = isNode ? (function () { try { return require('worker_threads'); } catch (e) { return null; } })() : null;
  const inWebWorker = !isNode && typeof importScripts === 'function' && typeof self !== 'undefined';
  const inNodeWorker = !!(nodeWT && !nodeWT.isMainThread && nodeWT.parentPort);

  /* Compact result of a solve: every scalar KPI, the costs and the checks – no hourly series, no equipment.
     This is what the optimiser and the Monte Carlo keep per design; it also crosses worker boundaries cheaply. */
  H2.summary = function (sys) {
    const a = sys.annual.kpi, k = {};
    Object.keys(a).forEach(x => { const v = a[x]; if (v == null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') k[x] = v; else if (x === 'partPressure') k[x] = v; });
    return {
      name: sys.basis.name, kpi: Object.assign({}, sys.kpi), annual: k, capex: Object.assign({}, sys.annual.capex), breakdown: Object.assign({}, sys.annual.breakdown),
      design: Object.assign({}, sys.design.kpi), site: sys.annual.site || null,
      checks: sys.checks.map(c => ({ group: c.group, name: c.name, ok: !!c.ok, value: c.value, unit: c.unit, limit: c.limit, ref: c.ref })),
      pass: sys.checks.filter(c => c.ok).length, fails: sys.checks.filter(c => !c.ok).map(c => c.name),
      warnings: sys.msgs.filter(m => m.level === 'warn').length, equip: sys.equip.length, streams: sys.streams.length, time_ms: sys.time_ms
    };
  };

  /* A copy that crosses a worker boundary (structured clone): functions dropped, typed arrays, arrays, plain objects,
     numbers, strings, booleans, null kept. Solver results carry a few closures (the system curve's atLoad, …). */
  H2.plain = function plain(v, depth) {
    depth = depth || 0;
    if (v == null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'function' || depth > 32) return undefined;
    if (ArrayBuffer.isView(v)) return v;
    if (Array.isArray(v)) return v.map(x => { const y = plain(x, depth + 1); return y === undefined ? null : y; });
    if (typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) { const y = plain(v[k], depth + 1); if (y !== undefined) o[k] = y; } return o; }
    return undefined;
  };

  const FNS = {
    summary: b => H2.summary(H2.solveSystem(b)),
    solve: b => H2.plain(H2.solveSystem(b)),
    hourly: b => H2.plain(H2.hourly(H2.hourlyFromBasis(b))),
    run: a => H2.run(a[0], a[1]),
    ping: x => x
  };
  const pool = H2.pool = function (n, opts) { return new Pool(n, opts); };
  pool.define = (name, fn) => { FNS[name] = fn; };     // registered in the bundle, so every worker has it
  pool.fns = () => Object.keys(FNS);
  pool.cores = () => {
    if (isNode) { try { return require('os').cpus().length; } catch (e) { return 2; } }
    return (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2;
  };
  pool.available = () => (isNode ? !!nodeWT : typeof Worker === 'function');     // a worker may itself spawn a pool
  // one call, serially, in this thread (the fallback when no workers exist, and the reference for the parity test)
  pool.local = (fn, args) => { const f = FNS[fn]; if (!f) throw new Error('unknown pool function: ' + fn); return args.map(a => f(a)); };

  /* ---------------- worker side ---------------- */
  function serve(post, listen) {
    listen(msg => {
      if (!msg || msg.type !== 'hasim-pool') return;
      const { id, fn, args } = msg; const f = FNS[fn];
      try {
        if (!f) throw new Error('unknown pool function: ' + fn);
        const result = args.map(a => f(a));
        post({ type: 'hasim-pool', id, ok: true, result });
      } catch (e) { post({ type: 'hasim-pool', id, ok: false, error: String(e && e.message || e) }); }
    });
  }
  if (inWebWorker) serve(m => self.postMessage(m), h => { self.addEventListener('message', ev => h(ev.data)); });
  else if (inNodeWorker) serve(m => nodeWT.parentPort.postMessage(m), h => nodeWT.parentPort.on('message', h));

  /* ---------------- client side ---------------- */
  function Pool(n, opts) {
    opts = opts || {};
    this.size = Math.max(1, Math.min(64, n || pool.cores()));
    this.script = opts.script || H2.ENGINE_PATH || H2.ENGINE_URL || 'js/hasim-engine.js';
    this.workers = []; this.idle = []; this.waiting = []; this.seq = 0; this.pending = new Map(); this.closed = false;
    if (!pool.available()) throw new Error('worker threads are not available here – use H2.pool.local or run the bundle in Node or a browser');
    for (let i = 0; i < this.size; i++) this.workers.push(this._spawn(i));
  }
  Pool.prototype._spawn = function (i) {
    const w = { i, busy: false, raw: null };
    const onMsg = m => { if (!m || m.type !== 'hasim-pool') return; const p = this.pending.get(m.id); if (!p) return; this.pending.delete(m.id); w.busy = false; this._next(w); if (m.ok) p.resolve(m.result); else p.reject(new Error(m.error)); };
    const onErr = e => { const err = e && e.message ? e : new Error(String(e && e.message || e)); for (const [id, p] of this.pending) if (p.worker === w) { this.pending.delete(id); p.reject(err); } w.busy = false; };
    if (isNode) { w.raw = new nodeWT.Worker(this.script); w.raw.on('message', onMsg); w.raw.on('error', onErr); w.raw.unref(); }   // idle workers never keep Node alive
    else { w.raw = new Worker(this.script); w.raw.onmessage = ev => onMsg(ev.data); w.raw.onerror = onErr; }
    w.post = m => w.raw.postMessage(m);
    this.idle.push(w);
    return w;
  };
  Pool.prototype._next = function (w) {
    if (this.closed) return;
    const job = this.waiting.shift();
    if (!job) { if (!this.idle.includes(w)) this.idle.push(w); if (isNode) w.raw.unref(); return; }
    const idx = this.idle.indexOf(w); if (idx >= 0) this.idle.splice(idx, 1);
    w.busy = true; job.worker = w; this.pending.set(job.id, job);
    if (isNode) w.raw.ref();                              // a busy worker keeps the process alive until it answers
    w.post({ type: 'hasim-pool', id: job.id, fn: job.fn, args: job.args });
  };
  /* run(fn, args, opts): fn by name; args = one argument per call (a basis, or [id, inputs] for 'run').
     Returns a Promise of the results in the order of args. opts.chunk = calls per message (default: spread over 4 rounds),
     opts.onProgress(done, total) after every chunk. */
  Pool.prototype.run = function (fn, args, opts) {
    opts = opts || {};
    const total = args.length; if (!total) return Promise.resolve([]);
    const chunk = Math.max(1, opts.chunk || Math.ceil(total / (this.size * 4)));
    const out = new Array(total); let done = 0; const jobs = [];
    for (let s = 0; s < total; s += chunk) {
      const slice = args.slice(s, s + chunk), id = ++this.seq;
      jobs.push(new Promise((resolve, reject) => {
        this.waiting.push({ id, fn, args: slice, worker: null,
          resolve: r => { for (let i = 0; i < r.length; i++) out[s + i] = r[i]; done += r.length; if (opts.onProgress) opts.onProgress(done, total); resolve(); }, reject });
      }));
    }
    for (const w of this.idle.slice()) this._next(w);
    return Promise.all(jobs).then(() => out);
  };
  Pool.prototype.close = function () {
    this.closed = true;
    for (const w of this.workers) { try { w.raw.terminate(); } catch (e) { /* already gone */ } }
    for (const [, p] of this.pending) p.reject(new Error('pool closed'));
    this.pending.clear(); this.waiting.length = 0; this.workers.length = 0; this.idle.length = 0;
  };
})(typeof window !== 'undefined' ? window : globalThis);

;
/* Hasim – Green Hydrogen Engineering Suite. © 2026 Prof. Hani Muhsen. All rights reserved. */
/* =====================================================================
   Hasim – engine-site.js (Hasim 3.0): measured site data
   Weather files – CSV with column mapping, EnergyPlus EPW, PVGIS hourly and TMY, NASA POWER (CSV and JSON),
   NREL TMY3 and NSRDB PSM3 – and hourly series of electricity prices and grid carbon intensities: parsing,
   placement on the 8760-hour year in local solar time, quality control (physical limits, night offsets,
   stuck sensors), gap filling, statistics (annual GHI, Weibull fit of the wind), the measured year in place
   of the synthetic one, and the helpers of the price-following grid operation.
   Literature: Muhsen (2026) §13.6 and Eq. 13.35 (field data, quality control, validation metrics), Eq. 4.2
   and 4.4 (Weibull fit by moments and maximum likelihood), Eq. 4.6 (power-law shear); Long & Dutton (2002),
   BSRN physically-possible limits of the irradiance; Delegated Regulation (EU) 2023/1184 Art. 4(3).
   Nothing here is taken from any other simulation software.
   Owner and developer: Prof. Hani Muhsen.
   ===================================================================== */
(function (root) {
  'use strict';
  const H2 = root.H2;
  const N = 8760, DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], DOY0 = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const MAX_YEARS = 12;
  // hour index (0…8759) of month m, day d, hour hr (0…23) in a 365-day year; Feb 29 and invalid dates → -1
  const hourIndex = (m, d, hr) => (!(m >= 1 && m <= 12 && d >= 1 && hr >= 0 && hr <= 23) || (m === 2 && d === 29) || d > DAYS[m - 1]) ? -1 : (DOY0[m - 1] + d - 1) * 24 + hr;
  const sum = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
  const mean = a => (a.length ? sum(a) / a.length : NaN);
  const round = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f) / f; };
  const SOURCE = { epw: 'EnergyPlus weather file (EPW)', pvgis: 'PVGIS', nasa: 'NASA POWER', 'nasa-json': 'NASA POWER', tmy3: 'NREL TMY3', psm3: 'NSRDB (PSM3)', csv: 'CSV file', json: 'JSON array' };
  H2.SITE_FORMATS = [['auto', 'Detect automatically'], ['csv', 'CSV / text with column mapping'], ['epw', 'EnergyPlus EPW'], ['pvgis', 'PVGIS hourly or TMY (CSV)'], ['nasa', 'NASA POWER hourly (CSV)'], ['nasa-json', 'NASA POWER hourly (JSON)'], ['tmy3', 'NREL TMY3'], ['psm3', 'NSRDB PSM3 / SAM CSV']];

  /* ---------- text tables ---------- */
  // a cell → number; blanks and the usual missing-value words → NaN; decimal commas accepted
  const num = s => {
    if (s == null) return NaN; s = String(s).trim();
    if (!s || /^(na|n\/a|nan|null|none|-|n\/e|\?|missing)$/i.test(s)) return NaN;
    if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
    const v = Number(s); return isFinite(v) ? v : NaN;
  };
  /* split a text into rows of cells: the delimiter (comma, semicolon, tab, bar or white space) is the one that
     occurs most in the first lines; quotes are honoured; empty lines and # comments are skipped */
  H2.csvTable = function (text, opt) {
    opt = opt || {};
    const lines = String(text).replace(/^﻿/, '').split(/\r\n|\r|\n/).filter(l => l.trim() !== '' && !/^\s*#/.test(l));
    const sample = lines.slice(0, 50);
    let delim = opt.delim;
    if (!delim) { const cnt = {}; [',', ';', '\t', '|'].forEach(c => { cnt[c] = sample.reduce((s, l) => s + (l.split(c).length - 1), 0); }); delim = [',', ';', '\t', '|'].sort((a, b) => cnt[b] - cnt[a])[0]; if (!cnt[delim]) delim = ' '; }
    const splitLine = delim === ' ' ? l => l.trim().split(/\s+/) : l => { const out = []; let cur = '', q = false;
      for (let i = 0; i < l.length; i++) { const ch = l[i]; if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === delim && !q) { out.push(cur); cur = ''; } else cur += ch; }
      out.push(cur); return out.map(s => s.trim()); };
    return { delim, rows: lines.map(splitLine) };
  };
  const isHeader = cells => cells.length > 0 && cells.filter(c => isFinite(num(c))).length < Math.max(1, cells.length / 2);
  /* a time stamp → { y, m, d, h } (ISO, PVGIS YYYYMMDD:HHMM, DD.MM.YYYY HH:MM, MM/DD/YYYY HH:MM, epoch seconds / ms) or null */
  H2.parseTime = function (s) {
    if (s == null) return null; s = String(s).trim(); let m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2})(?::?(\d{2}))?)?/.exec(s))) return { y: +m[1], m: +m[2], d: +m[3], h: m[4] == null ? 0 : +m[4], min: m[5] == null ? 0 : +m[5] };
    if ((m = /^(\d{4})(\d{2})(\d{2}):?(\d{2})(\d{2})?$/.exec(s)) && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31 && +m[4] <= 23) return { y: +m[1], m: +m[2], d: +m[3], h: +m[4], min: m[5] == null ? 0 : +m[5] };
    if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[T ,]+(\d{1,2})[:.](\d{2}))?/.exec(s))) return { y: +m[3], m: +m[2], d: +m[1], h: m[4] == null ? 0 : +m[4], min: m[5] == null ? 0 : +m[5] };
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T ,]+(\d{1,2}):(\d{2}))?/.exec(s))) return { y: +m[3], m: +m[1], d: +m[2], h: m[4] == null ? 0 : +m[4], min: m[5] == null ? 0 : +m[5] };
    if (/^\d{9,13}$/.test(s)) { const t = +s, D = new Date(t > 1e11 ? t : t * 1000); return { y: D.getUTCFullYear(), m: D.getUTCMonth() + 1, d: D.getUTCDate(), h: D.getUTCHours(), min: D.getUTCMinutes() }; }
    return null;
  };
  // hour-ending stamps (EPW, TMY3: 1…24) become hour-beginning (0…23)
  const hourEnding = h => (h >= 1 && h <= 24 ? h - 1 : h);

  /* ---------- format detection ---------- */
  H2.detectFormat = function (text, name) {
    const head = String(text).slice(0, 6000), first = (head.split(/\r\n|\r|\n/).find(l => l.trim()) || ''), ext = String(name || '').toLowerCase().split('.').pop();
    if (/^LOCATION,/i.test(first) || ext === 'epw') return 'epw';
    if (/^\s*\{/.test(head) && /"parameter"/.test(head)) return 'nasa-json';
    if (/-BEGIN HEADER-/.test(head) || /^YEAR,MO,DY,HR/im.test(head)) return 'nasa';
    if (/^Latitude \(decimal degrees\):/im.test(head) || /^time\(UTC\),/im.test(head) || /^time,.*\b(G\(i\)|G\(h\)|T2m)\b/im.test(head)) return 'pvgis';
    if (/^Source,Location ID/i.test(first)) return 'psm3';
    if (/GHI \(W\/m\^?2\)/i.test(head) && /Dry-bulb/i.test(head)) return 'tmy3';
    if (/^\s*\[/.test(head)) return 'json';
    return 'csv';
  };

  /* ---------- parsers: text → { meta, cols: {ghi, tam, ws, dni, dhi}, time: {y, m, d, h, min} | null, n, timeIs, columns, mapping } ---------- */
  const blank = n => { const a = new Float64Array(n); a.fill(NaN); return a; };
  const timeArrays = n => ({ y: new Int32Array(n), m: new Int32Array(n), d: new Int32Array(n), h: new Int32Array(n), min: new Int32Array(n) });
  const miss = (v, code) => (!isFinite(v) || (code != null && v >= code) ? NaN : v);

  function parseEPW(text) {
    const lines = String(text).split(/\r\n|\r|\n/), loc = (lines[0] || '').split(',');
    const meta = { name: [loc[1], loc[3]].filter(Boolean).join(', ') || 'EPW', station: loc[5] || '', lat: num(loc[6]), lon: num(loc[7]), tz: num(loc[8]), elev: num(loc[9]), ref_m: 10, source: 'EPW' + (loc[4] ? ' (' + loc[4].trim() + ')' : '') };
    let start = lines.findIndex(l => /^DATA PERIODS/i.test(l)); start = start < 0 ? 8 : start + 1;
    const rows = []; for (let i = start; i < lines.length; i++) { const l = lines[i]; if (!l.trim()) continue; const c = l.split(','); if (c.length < 22 || !isFinite(+c[0])) continue; rows.push(c); }
    const n = rows.length, T = timeArrays(n), cols = { ghi: blank(n), tam: blank(n), ws: blank(n), dni: blank(n), dhi: blank(n) };
    rows.forEach((c, i) => { T.y[i] = +c[0]; T.m[i] = +c[1]; T.d[i] = +c[2]; T.h[i] = hourEnding(+c[3]); T.min[i] = 0; cols.tam[i] = miss(+c[6], 99.9); cols.ghi[i] = miss(+c[13], 9999); cols.dni[i] = miss(+c[14], 9999); cols.dhi[i] = miss(+c[15], 9999); cols.ws[i] = miss(+c[21], 999); });
    return { meta, cols, time: T, n, timeIs: 'local' };
  }
  function parsePVGIS(text) {
    const lines = String(text).split(/\r\n|\r|\n/), meta = { ref_m: 10, source: 'PVGIS', tz: 0 };
    for (const l of lines.slice(0, 15)) {
      let m; if ((m = /^Latitude[^:]*:\s*([-\d.]+)/i.exec(l))) meta.lat = +m[1]; if ((m = /^Longitude[^:]*:\s*([-\d.]+)/i.exec(l))) meta.lon = +m[1];
      if ((m = /^Elevation[^:]*:\s*([-\d.]+)/i.exec(l))) meta.elev = +m[1]; if ((m = /^Radiation database:\s*(.+)/i.exec(l))) meta.source = 'PVGIS ' + m[1].trim();
    }
    const hi = lines.findIndex(l => /^time/i.test(l)); if (hi < 0) throw new Error('PVGIS file without a time column');
    const header = lines[hi].split(',').map(s => s.trim()), col = re => header.findIndex(x => re.test(x));
    const cG = col(/^G\(h\)$/i) >= 0 ? col(/^G\(h\)$/i) : col(/^G\(i\)$/i), cT = col(/^T2m$/i), cW = col(/^WS10m$/i), cB = col(/^Gb\(n\)$/i), cD = col(/^Gd\(h\)$/i);
    if (cG < 0) throw new Error('PVGIS file without G(h) or G(i): export the TMY, or the hourly data with the irradiance components');
    const rows = []; for (let i = hi + 1; i < lines.length; i++) { const l = lines[i]; if (!/^\d{8}:\d{4}/.test(l)) { if (rows.length) break; continue; } rows.push(l.split(',')); }
    const n = rows.length, T = timeArrays(n), cols = { ghi: blank(n), tam: blank(n), ws: blank(n) }; if (cB >= 0) cols.dni = blank(n); if (cD >= 0) cols.dhi = blank(n);
    rows.forEach((c, i) => { const s = c[0]; T.y[i] = +s.slice(0, 4); T.m[i] = +s.slice(4, 6); T.d[i] = +s.slice(6, 8); T.h[i] = +s.slice(9, 11); T.min[i] = +s.slice(11, 13) || 0;
      cols.ghi[i] = num(c[cG]); if (cT >= 0) cols.tam[i] = num(c[cT]); if (cW >= 0) cols.ws[i] = num(c[cW]); if (cB >= 0) cols.dni[i] = num(c[cB]); if (cD >= 0) cols.dhi[i] = num(c[cD]); });
    meta.name = 'PVGIS ' + (isFinite(meta.lat) ? meta.lat.toFixed(3) + '°, ' + meta.lon.toFixed(3) + '°' : '');
    if (col(/^G\(h\)$/i) < 0) meta.note = 'G(i), the irradiance in the plane of the array, is used as the horizontal irradiance – export with slope 0° or use the TMY';
    const tmy = header[0].toLowerCase().indexOf('utc') >= 0 && rows.length && rows.length <= 8784 && new Set(rows.map(c => c[0].slice(0, 4))).size > 1;
    return { meta, cols, time: T, n, timeIs: 'utc', tmy };
  }
  function parseNASA(text) {
    const lines = String(text).split(/\r\n|\r|\n/), meta = { source: 'NASA POWER', tz: 0 }; let lst = false;
    lines.slice(0, 60).forEach(l => { let m; if ((m = /latitude\s*([-\d.]+)\s*longitude\s*([-\d.]+)/i.exec(l))) { meta.lat = +m[1]; meta.lon = +m[2]; } if ((m = /Elevation[^:]*:\s*([-\d.]+)/i.exec(l))) meta.elev = +m[1]; if (/time standard.*(LST|local)/i.test(l)) lst = true; });
    const hi = lines.findIndex(l => /^YEAR,MO,DY,HR/i.test(l)); if (hi < 0) throw new Error('NASA POWER file without hourly columns (YEAR,MO,DY,HR) – request the hourly data');
    const header = lines[hi].split(',').map(s => s.trim()), col = re => header.findIndex(x => re.test(x));
    const cG = col(/^ALLSKY_SFC_SW_DWN$/i), cT = col(/^T2M$/i), c50 = col(/^WS50M$/i), c10 = col(/^WS10M$/i), cB = col(/^ALLSKY_SFC_SW_DNI$/i), cD = col(/^ALLSKY_SFC_SW_DIFF$/i);
    if (cG < 0) throw new Error('NASA POWER file without ALLSKY_SFC_SW_DWN');
    const cW = c50 >= 0 ? c50 : c10; meta.ref_m = c50 >= 0 ? 50 : 10;
    const rows = []; for (let i = hi + 1; i < lines.length; i++) { const c = lines[i].split(','); if (c.length < 5 || !isFinite(+c[0])) continue; rows.push(c); }
    const n = rows.length, T = timeArrays(n), cols = { ghi: blank(n), tam: blank(n), ws: blank(n) }; if (cB >= 0) cols.dni = blank(n); if (cD >= 0) cols.dhi = blank(n);
    const mv = v => (v <= -998 ? NaN : v);
    rows.forEach((c, i) => { T.y[i] = +c[0]; T.m[i] = +c[1]; T.d[i] = +c[2]; T.h[i] = +c[3]; T.min[i] = 0; cols.ghi[i] = mv(num(c[cG])); if (cT >= 0) cols.tam[i] = mv(num(c[cT])); if (cW >= 0) cols.ws[i] = mv(num(c[cW])); if (cB >= 0) cols.dni[i] = mv(num(c[cB])); if (cD >= 0) cols.dhi[i] = mv(num(c[cD])); });
    meta.name = 'NASA POWER ' + (isFinite(meta.lat) ? meta.lat.toFixed(2) + '°, ' + meta.lon.toFixed(2) + '°' : '');
    return { meta, cols, time: T, n, timeIs: lst ? 'solar' : 'utc' };
  }
  function parseNASAJSON(text) {
    const J = typeof text === 'string' ? JSON.parse(text) : text, P = J && J.properties && J.properties.parameter; if (!P) throw new Error('not a NASA POWER JSON response');
    const meta = { source: 'NASA POWER', tz: 0 }; const g = J.geometry && J.geometry.coordinates; if (g) { meta.lon = +g[0]; meta.lat = +g[1]; meta.elev = +g[2]; }
    const lst = /LST|local/i.test(JSON.stringify(J.header || {}) + JSON.stringify(J.parameters || {}).slice(0, 2000));
    const G = P.ALLSKY_SFC_SW_DWN; if (!G) throw new Error('NASA POWER JSON without ALLSKY_SFC_SW_DWN');
    const keys = Object.keys(G).filter(k => /^\d{10}$/.test(k)).sort(); if (!keys.length) throw new Error('NASA POWER JSON without hourly values (keys YYYYMMDDHH)');
    const W = P.WS50M || P.WS10M; meta.ref_m = P.WS50M ? 50 : 10;
    const n = keys.length, T = timeArrays(n), cols = { ghi: blank(n), tam: blank(n), ws: blank(n) }; if (P.ALLSKY_SFC_SW_DNI) cols.dni = blank(n); if (P.ALLSKY_SFC_SW_DIFF) cols.dhi = blank(n);
    const mv = v => (v == null || v <= -998 ? NaN : +v);
    keys.forEach((k, i) => { T.y[i] = +k.slice(0, 4); T.m[i] = +k.slice(4, 6); T.d[i] = +k.slice(6, 8); T.h[i] = +k.slice(8, 10); cols.ghi[i] = mv(G[k]); if (P.T2M) cols.tam[i] = mv(P.T2M[k]); if (W) cols.ws[i] = mv(W[k]); if (cols.dni) cols.dni[i] = mv(P.ALLSKY_SFC_SW_DNI[k]); if (cols.dhi) cols.dhi[i] = mv(P.ALLSKY_SFC_SW_DIFF[k]); });
    meta.name = 'NASA POWER ' + (isFinite(meta.lat) ? meta.lat.toFixed(2) + '°, ' + meta.lon.toFixed(2) + '°' : '');
    return { meta, cols, time: T, n, timeIs: lst ? 'solar' : 'utc' };
  }
  function parseTMY3(text) {
    const lines = String(text).split(/\r\n|\r|\n/), l1 = H2.csvTable(lines[0], { delim: ',' }).rows[0] || [];
    const meta = { station: l1[0] || '', name: [l1[1], l1[2]].filter(Boolean).join(', ') || 'TMY3', tz: num(l1[3]), lat: num(l1[4]), lon: num(l1[5]), elev: num(l1[6]), ref_m: 10, source: 'NREL TMY3' };
    const header = (lines[1] || '').split(',').map(s => s.trim()), col = re => header.findIndex(x => re.test(x));
    const cG = col(/^GHI \(W/i), cB = col(/^DNI \(W/i), cD = col(/^DHI \(W/i), cT = col(/^Dry-bulb/i), cW = col(/^Wspd/i);
    if (cG < 0 || cT < 0) throw new Error('TMY3 file without the GHI and dry-bulb columns');
    const rows = []; for (let i = 2; i < lines.length; i++) { const c = lines[i].split(','); if (c.length < 10 || !/\d+\/\d+\/\d{4}/.test(c[0])) continue; rows.push(c); }
    const n = rows.length, T = timeArrays(n), cols = { ghi: blank(n), tam: blank(n), ws: blank(n) }; if (cB >= 0) cols.dni = blank(n); if (cD >= 0) cols.dhi = blank(n);
    rows.forEach((c, i) => { const dt = c[0].split('/'), tm = c[1].split(':'); T.y[i] = +dt[2]; T.m[i] = +dt[0]; T.d[i] = +dt[1]; T.h[i] = hourEnding(+tm[0]); T.min[i] = 0;
      cols.ghi[i] = num(c[cG]); cols.tam[i] = num(c[cT]); if (cW >= 0) cols.ws[i] = num(c[cW]); if (cB >= 0) cols.dni[i] = num(c[cB]); if (cD >= 0) cols.dhi[i] = num(c[cD]); });
    return { meta, cols, time: T, n, timeIs: 'local' };
  }
  function parsePSM3(text) {
    const lines = String(text).split(/\r\n|\r|\n/), h1 = lines[0].split(',').map(s => s.trim()), h2 = (lines[1] || '').split(',').map(s => s.trim());
    const md = {}; h1.forEach((k, i) => { if (k) md[k] = h2[i]; });
    const meta = { name: [md.City, md.State, md.Country].filter(x => x && x !== '-').join(', ') || ('NSRDB ' + (md['Location ID'] || '')), station: md['Location ID'] || '', lat: num(md.Latitude), lon: num(md.Longitude), tz: num(md['Time Zone']), elev: num(md.Elevation), ref_m: 2, source: (md.Source || 'NSRDB') + ' (PSM3)',
      note: 'NSRDB wind speeds are reanalysis values at 2 m above ground: extrapolated to the hub height by the shear law – use a wind-specific dataset for wind projects' };
    const header = (lines[2] || '').split(',').map(s => s.trim()), col = re => header.findIndex(x => re.test(x));
    const cY = col(/^Year$/i), cM = col(/^Month$/i), cD = col(/^Day$/i), cH = col(/^Hour$/i), cMi = col(/^Minute$/i), cG = col(/^GHI$/i), cDn = col(/^DNI$/i), cDh = col(/^DHI$/i), cT = col(/^Temperature$/i), cW = col(/^Wind Speed$/i);
    if (cY < 0 || cG < 0) throw new Error('NSRDB file without Year and GHI columns');
    const rows = []; for (let i = 3; i < lines.length; i++) { const c = lines[i].split(','); if (c.length < 6 || !isFinite(+c[cY])) continue; rows.push(c); }
    const n = rows.length, T = timeArrays(n), cols = { ghi: blank(n), tam: blank(n), ws: blank(n) }; if (cDn >= 0) cols.dni = blank(n); if (cDh >= 0) cols.dhi = blank(n);
    rows.forEach((c, i) => { T.y[i] = +c[cY]; T.m[i] = +c[cM]; T.d[i] = +c[cD]; T.h[i] = +c[cH]; T.min[i] = cMi >= 0 ? +c[cMi] : 0; cols.ghi[i] = num(c[cG]); if (cT >= 0) cols.tam[i] = num(c[cT]); if (cW >= 0) cols.ws[i] = num(c[cW]); if (cDn >= 0) cols.dni[i] = num(c[cDn]); if (cDh >= 0) cols.dhi[i] = num(c[cDh]); });
    return { meta, cols, time: T, n, timeIs: 'local' };
  }
  /* generic CSV: columns found by their header names or given in opt.map = { ghi, tam, ws, dni, dhi, time, year, month, day, hour }
     (a header name or a 0-based column index); without a header three numeric columns are taken as GHI, temperature, wind */
  const SUF = '([\\s_-]*[\\[(].*|[_\\s-].*)?$';
  const AUTO = { ghi: new RegExp('^(ghi|g\\(h\\)|gh|global|global[\\s_-]?hor.*|ssrd|irradiance|radiation|allsky_sfc_sw_dwn|solar|g)' + SUF, 'i'),
    tam: new RegExp('^(t|ta|tam|tamb|temp|temperature|t2m|tair|t_air|dry[\\s_-]?bulb.*|air[\\s_-]?temp.*|temp.*)' + SUF, 'i'),
    ws: /^(ws|v|u|wspd|ws\d+m|wind|wind[\s_-]?speed|windspeed|speed)([\s_-]*[\[(].*|[_\s-](?!dir).*)?$/i,
    dni: new RegExp('^(dni|bni|gb\\(n\\)|direct.*|beam.*)' + SUF, 'i'), dhi: new RegExp('^(dhi|dif|gd\\(h\\)|diffuse.*)' + SUF, 'i'),
    time: new RegExp('^(time|date|datetime|timestamp|period.*|mtu.*|utc.*|local.*|time\\(utc\\))' + SUF, 'i'), year: /^(year|yr|y|yyyy)$/i, month: /^(month|mo|mon|mm)$/i, day: /^(day|dy|dd)$/i, hour: /^(hour|hr|hh|h)$/i };
  function findCol(header, map, key) {
    if (map && map[key] != null && map[key] !== '') { const v = map[key]; if (typeof v === 'number') return v; const i = header.findIndex(x => x.toLowerCase() === String(v).toLowerCase()); if (i >= 0) return i; const j = +v; return isFinite(j) ? j : -1; }
    return header.findIndex(x => AUTO[key].test(x));
  }
  H2.SITE_COLUMNS = ['ghi', 'tam', 'ws', 'dni', 'dhi', 'time', 'year', 'month', 'day', 'hour'];
  function parseCSV(text, opt) {
    opt = opt || {}; const tab = H2.csvTable(text, opt), rows = tab.rows; if (!rows.length) throw new Error('the file is empty');
    const hasHeader = opt.header != null ? !!opt.header : isHeader(rows[0]);
    const header = hasHeader ? rows[0] : rows[0].map((_, i) => 'column ' + (i + 1)), data = hasHeader ? rows.slice(1) : rows;
    const map = Object.assign({}, opt.map || {}); const c = {}; H2.SITE_COLUMNS.forEach(k => { c[k] = hasHeader || map[k] != null ? findCol(header, map, k) : -1; });
    if (!hasHeader && map.ghi == null) { const w = rows[0].length; if (w >= 3) { c.ghi = w - 3; c.tam = w - 2; c.ws = w - 1; } else c.ghi = 0; }
    if (c.ghi < 0 && c.ws < 0 && c.tam < 0) throw new Error('no irradiance, temperature or wind column found – map the columns');
    const n = data.length, cols = {}; ['ghi', 'tam', 'ws', 'dni', 'dhi'].forEach(k => { if (c[k] >= 0 || k === 'ghi' || k === 'tam' || k === 'ws') cols[k] = blank(n); });
    const hasTime = c.time >= 0 || (c.month >= 0 && c.day >= 0 && c.hour >= 0);
    const T = hasTime ? timeArrays(n) : null; let bad = 0;
    data.forEach((r, i) => {
      ['ghi', 'tam', 'ws', 'dni', 'dhi'].forEach(k => { if (cols[k] && c[k] >= 0) cols[k][i] = num(r[c[k]]); });
      if (!T) return;
      if (c.time >= 0) { const t = H2.parseTime(r[c.time]); if (t) { T.y[i] = t.y; T.m[i] = t.m; T.d[i] = t.d; T.h[i] = t.h; T.min[i] = t.min || 0; } else { T.m[i] = 0; bad++; } }
      else { T.y[i] = c.year >= 0 ? num(r[c.year]) : 0; T.m[i] = num(r[c.month]); T.d[i] = num(r[c.day]); T.h[i] = num(r[c.hour]); T.min[i] = 0; }
    });
    if (T && bad > n / 2) throw new Error('the time stamps could not be read (' + bad + ' of ' + n + ' rows) – use ISO dates, YYYYMMDD:HHMM, DD.MM.YYYY HH:MM or MM/DD/YYYY HH:MM, or map year, month, day and hour columns');
    if (T && opt.hourEnding) for (let i = 0; i < n; i++) T.h[i] = hourEnding(T.h[i]);
    const meta = { name: opt.name || 'CSV', source: 'CSV file', ref_m: opt.ref_m || 10, lat: opt.lat, lon: opt.lon, tz: opt.tz };
    return { meta, cols, time: T, n, timeIs: typeof opt.tz === 'number' ? 'local' : opt.tz === 'utc' ? 'utc' : 'solar', columns: header, mapping: c, delim: tab.delim, hasHeader, badTime: bad };
  }
  const PARSERS = { epw: parseEPW, pvgis: parsePVGIS, nasa: parseNASA, 'nasa-json': parseNASAJSON, tmy3: parseTMY3, psm3: parsePSM3, csv: parseCSV };

  /* ---------- placement on the 8760-hour year ---------- */
  /* rows → years: sub-hourly rows of the same hour are averaged, Feb 29 dropped, absent hours become NaN;
     without time stamps the file must hold whole years at an hourly, half-hourly or quarter-hourly step */
  function placeYears(raw, opt) {
    const names = Object.keys(raw.cols), notes = [], out = [];
    const mk = (year, label) => { const o = { year, label: label || String(year), rows: 0, sum: {}, cnt: {} }; names.forEach(k => { o.sum[k] = new Float64Array(N); o.cnt[k] = new Float64Array(N); }); return o; };
    if (raw.time) {
      const Y = new Map();
      for (let i = 0; i < raw.n; i++) {
        const idx = hourIndex(raw.time.m[i], raw.time.d[i], raw.time.h[i]); if (idx < 0) continue;
        const yr = raw.time.y[i] || 0; let B = Y.get(yr); if (!B) { B = mk(yr, raw.tmy ? 'TMY' : yr ? String(yr) : 'year'); Y.set(yr, B); }
        B.rows++; names.forEach(k => { const v = raw.cols[k][i]; if (isFinite(v)) { B.sum[k][idx] += v; B.cnt[k][idx]++; } });
      }
      if (raw.tmy && Y.size > 1) {   // a typical meteorological year assembled from months of different years: one year
        const all = mk(0, 'TMY'); Y.forEach(B => { all.rows += B.rows; names.forEach(k => { for (let i = 0; i < N; i++) { all.sum[k][i] += B.sum[k][i]; all.cnt[k][i] += B.cnt[k][i]; } }); }); Y.clear(); Y.set(0, all);
      }
      Array.from(Y.values()).sort((a, b) => a.year - b.year).forEach(B => { if (B.rows >= 0.5 * N) out.push(B); else notes.push((B.label || B.year) + ': only ' + B.rows + ' hours – not used'); });
      if (!out.length) throw new Error('no complete year in the file (' + raw.n + ' rows)');
    } else {
      const n = raw.n, step = opt.step || (n % N === 0 ? n / N : n % 8784 === 0 ? n / 8784 : 0), leap = n % N !== 0 && n % 8784 === 0;
      if (!(step === 1 || step === 2 || step === 4) || n !== step * (leap ? 8784 : N)) throw new Error(n + ' rows without time stamps: a file without dates must hold one year of 8760 hourly, 17 520 half-hourly or 35 040 quarter-hourly values (8784 / 17 568 / 35 136 in a leap year)');
      const B = mk(opt.year || 0, opt.year ? String(opt.year) : 'year');
      for (let i = 0; i < n; i++) { const hr = Math.floor(i / step); let idx = hr; if (leap) { if (hr >= 1416 && hr < 1440) continue; if (hr >= 1440) idx = hr - 24; } B.rows = N; names.forEach(k => { const v = raw.cols[k][i]; if (isFinite(v)) { B.sum[k][idx] += v; B.cnt[k][idx]++; } }); }
      out.push(B);
      if (step > 1) notes.push(step + ' values per hour averaged to hourly means'); if (leap) notes.push('leap day (29 February) dropped');
    }
    return { years: out.map(B => { const y = { year: B.year, label: B.label, rows: B.rows }; names.forEach(k => { const a = new Float64Array(N); for (let i = 0; i < N; i++) a[i] = B.cnt[k][i] > 0 ? B.sum[k][i] / B.cnt[k][i] : NaN; y[k] = a; }); return y; }), notes };
  }
  // circular shift to local solar time: index i of the file becomes i + shift
  function roll(a, shift) { if (!shift) return a; const n = a.length, o = new Float64Array(n); for (let i = 0; i < n; i++) o[((i + shift) % n + n) % n] = a[i]; return o; }

  /* ---------- quality control and gap filling (Muhsen 2026 §13.6; Long & Dutton 2002) ---------- */
  const cosZ = (lat, h) => { const d = Math.floor(h / 24) + 1, hr = h % 24 + 0.5, phi = lat * Math.PI / 180, decl = 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + d) / 365), w = (hr - 12) * 15 * Math.PI / 180; return Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(w); };
  const G0n = h => 1361 * (1 + 0.033 * Math.cos(2 * Math.PI * (Math.floor(h / 24) + 1) / 365));
  /* NaN runs: up to 6 h linear interpolation; longer gaps from the same hour of the nearest valid days (up to 7 days either
     side), then the monthly mean of that hour of day; returns the number of filled hours (-1: nothing valid at all) */
  function fillGaps(a, name) {
    const n = a.length; let valid = 0; for (let i = 0; i < n; i++) if (isFinite(a[i])) valid++;
    if (!valid) return -1; if (valid === n) return 0;
    const orig = Float64Array.from(a); let filled = 0;
    for (let i = 0; i < n; i++) {
      if (isFinite(orig[i])) continue;
      let j = i; while (j < n && !isFinite(orig[j])) j++; const len = j - i;
      const prev = i > 0 ? orig[i - 1] : NaN, next = j < n ? orig[j] : NaN;
      if (len <= 6 && isFinite(prev) && isFinite(next)) { for (let k = i; k < j; k++) a[k] = prev + (next - prev) * (k - i + 1) / (len + 1); }
      else for (let k = i; k < j; k++) {
        let v = NaN;
        for (let dd = 1; dd <= 7 && !isFinite(v); dd++) { const p = orig[((k - 24 * dd) % n + n) % n], q = orig[(k + 24 * dd) % n]; v = isFinite(p) && isFinite(q) ? (p + q) / 2 : isFinite(p) ? p : q; }
        if (!isFinite(v)) { const m0 = Math.floor(k / 24), hh = k % 24; let s = 0, c = 0; for (let d2 = Math.max(0, m0 - 15); d2 <= Math.min(364, m0 + 15); d2++) { const x = orig[d2 * 24 + hh]; if (isFinite(x)) { s += x; c++; } } v = c ? s / c : NaN; }
        if (!isFinite(v)) { let s = 0, c = 0; for (let t = 0; t < n; t++) if (isFinite(orig[t])) { s += orig[t]; c++; } v = s / c; }
        a[k] = v;
      }
      filled += len; i = j;
    }
    return filled;
  }
  // runs of identical consecutive values (a stuck sensor) longer than `len` hours → NaN; returns the count
  function unstick(a, len, test) { let n = 0, i = 0; while (i < a.length) { let j = i + 1; while (j < a.length && a[j] === a[i] && isFinite(a[i])) j++; if (j - i >= len && test(a[i], i, j)) { for (let k = i; k < j; k++) a[k] = NaN; n += j - i; } i = j; } return n; }
  /* in place: physical limits, night offsets, stuck sensors, gap filling; returns the QC record */
  H2.weatherQC = function (Y, lat) {
    lat = isFinite(lat) ? lat : 0;
    const qc = { coverage: {}, filled: {}, invalid: {}, capped: 0, night: 0, stuck: {}, notes: [], unusable: [] };
    const cols = ['ghi', 'tam', 'ws', 'dni', 'dhi'].filter(k => Y[k]);
    cols.forEach(k => { let v = 0; for (let i = 0; i < N; i++) if (isFinite(Y[k][i])) v++; qc.coverage[k] = v / N; });
    // irradiance: negative and night values → 0 (night offsets), daytime values above the BSRN physically-possible limit capped
    ['ghi', 'dni', 'dhi'].forEach(k => { const a = Y[k]; if (!a) return; let inv = 0;
      for (let h = 0; h < N; h++) { const v = a[h]; if (!isFinite(v)) continue; const cz = cosZ(lat, h);
        if (cz <= 0) { if (v !== 0) { qc.night++; a[h] = v > 50 ? NaN : 0; if (v > 50) inv++; } continue; }
        if (v < 0) { a[h] = v < -10 ? NaN : 0; if (v < -10) inv++; continue; }
        const lim = k === 'ghi' ? 1.5 * G0n(h) * Math.pow(cz, 1.2) + 100 : k === 'dni' ? G0n(h) : 0.95 * G0n(h) * Math.pow(cz, 1.2) + 50;
        if (v > lim) { a[h] = lim; qc.capped++; } }
      qc.invalid[k] = inv; qc.stuck[k] = unstick(a, 8, (v, i, j) => { if (!(v > 0)) return false; let day = 0; for (let t = i; t < j; t++) if (cosZ(lat, t) > 0.1) day++; return day >= 8; }); });
    if (Y.tam) { let inv = 0; for (let h = 0; h < N; h++) { const v = Y.tam[h]; if (isFinite(v) && (v < -60 || v > 60)) { Y.tam[h] = NaN; inv++; } } qc.invalid.tam = inv; qc.stuck.tam = unstick(Y.tam, 48, () => true); }
    if (Y.ws) { let inv = 0; for (let h = 0; h < N; h++) { const v = Y.ws[h]; if (isFinite(v) && (v < 0 || v > 60)) { Y.ws[h] = NaN; inv++; } } qc.invalid.ws = inv; qc.stuck.ws = unstick(Y.ws, 48, v => v > 0); let z = 0, zmax = 0; for (let h = 0; h < N; h++) { if (Y.ws[h] === 0) { z++; zmax = Math.max(zmax, z); } else z = 0; } if (zmax >= 72) qc.notes.push('wind speed stays at 0 for ' + zmax + ' consecutive hours – calm or a stuck anemometer'); }
    cols.forEach(k => { const f = fillGaps(Y[k], k); if (f < 0) { qc.unusable.push(k); qc.filled[k] = 0; } else qc.filled[k] = f; });
    qc.unusable.forEach(k => { if (k === 'dni' || k === 'dhi') { delete Y[k]; } });
    cols.forEach(k => { if (qc.filled[k] > 0.1 * N && !qc.unusable.includes(k)) qc.notes.push(k + ': ' + (100 * qc.filled[k] / N).toFixed(0) + ' % of the hours were filled – check the data source'); });
    if (qc.capped) qc.notes.push(qc.capped + ' irradiance values above the physically possible limit were capped');
    if (qc.night) qc.notes.push(qc.night + ' night-time irradiance values set to zero (night offsets)');
    Object.keys(qc.stuck).forEach(k => { if (qc.stuck[k]) qc.notes.push(k + ': ' + qc.stuck[k] + ' hours of a stuck sensor replaced'); });
    return qc;
  };

  /* ---------- statistics (Eq. 4.2 and 4.4 of Muhsen 2026) ---------- */
  // Weibull shape by the method of moments: solve σ/v̄ = sqrt(Γ(1+2/k)/Γ²(1+1/k) − 1) for k (bisection), and by maximum likelihood
  H2.weibullFit = function (ws) {
    const v = []; for (let i = 0; i < ws.length; i++) if (ws[i] > 0 && isFinite(ws[i])) v.push(ws[i]);
    const n = v.length; if (n < 24) return null;
    const m1 = mean(v); let s2 = 0; for (const x of v) s2 += (x - m1) * (x - m1); const sd = Math.sqrt(s2 / (n - 1)), cv = sd / m1;
    const ratio = k => Math.sqrt(H2.gamma(1 + 2 / k) / Math.pow(H2.gamma(1 + 1 / k), 2) - 1);
    let lo = 0.5, hi = 10; for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; if (ratio(mid) > cv) lo = mid; else hi = mid; }
    const kMom = (lo + hi) / 2, kJustus = Math.pow(cv, -1.086);
    let k = kMom, lnv = 0; for (const x of v) lnv += Math.log(x); lnv /= n;
    for (let it = 0; it < 60; it++) { let a = 0, b = 0; for (const x of v) { const p = Math.pow(x, k); a += p * Math.log(x); b += p; } const kn = 1 / (a / b - lnv); if (!(kn > 0.2 && kn < 20)) break; if (Math.abs(kn - k) < 1e-7) { k = kn; break; } k = kn; }
    let sk = 0; for (const x of v) sk += Math.pow(x, k); const cMle = Math.pow(sk / n, 1 / k);
    return { k_mom: kMom, k_justus: kJustus, k: k, c: cMle, c_mom: m1 / H2.gamma(1 + 1 / kMom), mean: m1, sd, n, calm: 1 - n / ws.length };
  };
  H2.weatherStats = function (Y) {
    const st = {}; const mm = (a, f) => H2.monthly(a, f);
    if (Y.ghi) { st.GHI = sum(Y.ghi) / 1000; st.GHI_max = Math.max.apply(null, Array.from(Y.ghi)); st.monthlyGHI = mm(Y.ghi).map(v => v / 1000); let sun = 0; for (let i = 0; i < N; i++) if (Y.ghi[i] > 120) sun++; st.sunHours = sun; }
    if (Y.dni) st.DNI = sum(Y.dni) / 1000;
    if (Y.tam) { st.T_mean = mean(Y.tam); st.T_min = Math.min.apply(null, Array.from(Y.tam)); st.T_max = Math.max.apply(null, Array.from(Y.tam)); st.monthlyT = mm(Y.tam, (s, n) => s / n); }
    if (Y.ws) { const w = H2.weibullFit(Y.ws); st.v_mean = mean(Y.ws); st.v_max = Math.max.apply(null, Array.from(Y.ws)); let s3 = 0; for (let i = 0; i < N; i++) s3 += Math.pow(Y.ws[i], 3); st.Ke = s3 / N / Math.pow(Math.max(st.v_mean, 1e-9), 3); st.monthlyV = mm(Y.ws, (s, n) => s / n);
      if (w) { st.k = w.k; st.k_mom = w.k_mom; st.c = w.c; st.v_sd = w.sd; st.calm = w.calm; } }
    return st;
  };
  /* the synthetic year of the same statistics against the measured one, monthly (Eq. 13.35): NMBE and CV(RMSE) */
  H2.weatherCompare = function (Y, lat, o) {
    const st = Y.stats || H2.weatherStats(Y); o = o || {};
    const W = H2.weather({ lat, GHI_annual: st.GHI || 1800, v_mean: st.v_mean || 6, k: st.k || 2, T_mean: isFinite(st.T_mean) ? st.T_mean : 20, seed: o.seed || 1, cloudiness: o.cloudiness == null ? 0.25 : o.cloudiness });
    const metric = (y, yh) => { const n = y.length, yb = mean(y); let sb = 0, sq = 0; for (let i = 0; i < n; i++) { sb += y[i] - yh[i]; sq += (y[i] - yh[i]) * (y[i] - yh[i]); } return { NMBE: sb / (n * yb), CV: Math.sqrt(sq / n) / yb }; };
    const out = { synthetic: {} };
    if (Y.ghi) { const s = H2.monthly(W.ghi).map(v => v / 1000); out.synthetic.monthlyGHI = s; out.ghi = metric(st.monthlyGHI, s); }
    if (Y.ws) { const s = H2.monthly(W.ws, (a, n) => a / n); out.synthetic.monthlyV = s; out.ws = metric(st.monthlyV, s); }
    if (Y.tam) { const s = H2.monthly(W.tam, (a, n) => a / n); out.synthetic.monthlyT = s; const y = st.monthlyT.map(v => v + 273.15), yh = s.map(v => v + 273.15); out.tam = metric(y, yh); }
    return out;
  };

  /* ---------- import: text → { format, meta, years: [{ label, year, ghi, tam, ws, dni?, dhi?, qc, stats }], notes, shift } ---------- */
  H2.parseWeather = function (text, opt) {
    opt = opt || {};
    const format = opt.format && opt.format !== 'auto' ? opt.format : H2.detectFormat(text, opt.name);
    const P = PARSERS[format]; if (!P) throw new Error('unknown weather format "' + format + '"');
    const raw = P(text, opt); const meta = raw.meta; meta.format = format; if (!meta.source) meta.source = SOURCE[format] || format;
    if (opt.name && !meta.file) meta.file = opt.name;
    if (isFinite(opt.lat)) meta.lat = +opt.lat; if (isFinite(opt.lon)) meta.lon = +opt.lon; if (opt.ref_m > 0) meta.ref_m = +opt.ref_m;
    const placed = placeYears(raw, opt), notes = placed.notes.slice();
    if (meta.note) notes.push(meta.note);
    // local solar time: UTC stamps shift by the longitude, zone time by the difference between the zone and the longitude
    const lon = isFinite(meta.lon) ? meta.lon : 0, tz = isFinite(meta.tz) ? meta.tz : 0;
    let shift = 0; const timeIs = opt.timeIs || raw.timeIs;
    if (timeIs === 'utc') shift = Math.round(lon / 15); else if (timeIs === 'local') shift = Math.round(lon / 15 - tz);
    if (shift && !isFinite(meta.lon)) { notes.push('longitude unknown – time stamps taken as local solar time'); shift = 0; }
    if (shift) notes.push('time stamps shifted by ' + (shift > 0 ? '+' : '') + shift + ' h to local solar time (longitude ' + lon.toFixed(1) + '°' + (timeIs === 'local' ? ', zone UTC' + (tz >= 0 ? '+' : '') + tz : ', UTC') + ')');
    const lat = isFinite(meta.lat) ? meta.lat : (isFinite(opt.latFallback) ? opt.latFallback : 0);
    if (!isFinite(meta.lat)) notes.push('latitude unknown – the quality control used ' + lat + '°; enter the site latitude in the design basis');
    const years = placed.years.map(y => {
      ['ghi', 'tam', 'ws', 'dni', 'dhi'].forEach(k => { if (y[k]) y[k] = roll(y[k], shift); });
      y.qc = H2.weatherQC(y, lat);
      ['ghi', 'tam', 'ws'].forEach(k => { if (y.qc.unusable.includes(k)) { if (k === 'ghi') y.ghi = new Float64Array(N); else if (k === 'tam') y.tam = new Float64Array(N).fill(20); else y.ws = new Float64Array(N); } });
      y.stats = H2.weatherStats(y);
      return y;
    });
    if (years.length > MAX_YEARS) { notes.push(years.length + ' years in the file – the last ' + MAX_YEARS + ' are kept'); years.splice(0, years.length - MAX_YEARS); }
    const unusable = years[0].qc.unusable.filter(k => k === 'ghi' || k === 'tam' || k === 'ws');
    if (unusable.length) notes.push('no usable values for ' + unusable.join(', ') + ' – ' + (unusable.includes('ghi') ? 'irradiance set to zero; ' : '') + (unusable.includes('tam') ? 'temperature set to 20 °C; ' : '') + (unusable.includes('ws') ? 'wind speed set to zero; ' : '') + 'map the column or choose another file');
    return { format, meta, years, notes, shift, columns: raw.columns || null, mapping: raw.mapping || null, delim: raw.delim, hasHeader: raw.hasHeader };
  };

  /* ---------- hourly series (prices, carbon intensity) ---------- */
  H2.SERIES_KINDS = { price: { label: 'electricity price', unit: 'EUR/MWh', min: -1000, max: 10000, col: /price|eur|usd|€|\$|cost|tarif|spot|day.?ahead|mwh/i },
    ci: { label: 'grid carbon intensity', unit: 'g CO₂/kWh', min: 0, max: 2000, col: /carbon|intensity|co2|co₂|emission|gco2|g\/kwh|kg\/mwh/i } };
  /* text → { series: Float64Array(8760), stats, notes, columns, column, n, unit }; opt: { kind, column, year, tz, lon, unit } */
  H2.parseSeries = function (text, opt) {
    opt = opt || {}; const kind = H2.SERIES_KINDS[opt.kind] || H2.SERIES_KINDS.price, notes = [];
    let values = null, times = null, header = null, column = null, hint = null;
    const s = String(text).trim();
    if (/^\s*\[/.test(s)) { values = JSON.parse(s).map(v => (typeof v === 'object' && v ? num(v.value != null ? v.value : v.price != null ? v.price : v.ci) : num(v))); }
    else {
      const tab = H2.csvTable(s), rows = tab.rows; if (!rows.length) throw new Error('the file is empty');
      const hasHeader = isHeader(rows[0]); header = hasHeader ? rows[0] : null; const data = hasHeader ? rows.slice(1) : rows;
      let ci = -1;
      if (opt.column != null && opt.column !== '') { ci = typeof opt.column === 'number' ? opt.column : header ? header.findIndex(x => x.toLowerCase() === String(opt.column).toLowerCase()) : -1; if (ci < 0 && isFinite(+opt.column)) ci = +opt.column; }
      if (ci < 0 && header) { ci = header.findIndex(x => kind.col.test(x)); hint = ci >= 0 ? header[ci] : null; }
      if (ci < 0) { // the last column with mostly numbers
        const w = Math.max.apply(null, data.slice(0, 50).map(r => r.length)); for (let c = w - 1; c >= 0 && ci < 0; c--) { const k = data.slice(0, 50).filter(r => isFinite(num(r[c]))).length; if (k >= 0.8 * Math.min(50, data.length)) ci = c; } }
      if (ci < 0) throw new Error('no numeric column found');
      column = header ? header[ci] : 'column ' + (ci + 1);
      const ti = header ? header.findIndex(x => AUTO.time.test(x)) : (data[0] && data[0].length > 1 && H2.parseTime(data[0][0]) ? 0 : -1);
      values = data.map(r => num(r[ci]));
      if (ti >= 0) { times = data.map(r => H2.parseTime(r[ti])); if (times.filter(Boolean).length < data.length / 2) times = null; }
      if (header && /kwh/i.test(header[ci]) && !/mwh/i.test(header[ci]) && opt.kind === 'price') { const f = /ct|cent|¢/i.test(header[ci]) ? 10 : 1000; values = values.map(v => v * f); notes.push('prices per kWh converted to EUR/MWh (× ' + f + ')'); }
      if (header && /\/mj/i.test(header[ci]) && opt.kind === 'ci') { values = values.map(v => v * 3.6); notes.push('g/MJ converted to g/kWh (× 3.6)'); }
      if (header && /(t|tonne)s?\s*\/\s*mwh/i.test(header[ci]) && opt.kind === 'ci') { values = values.map(v => v * 1000); notes.push('t/MWh converted to g/kWh (× 1000)'); }
    }
    if (opt.scale && isFinite(opt.scale) && +opt.scale !== 1) { values = values.map(v => v * opt.scale); notes.push('values multiplied by ' + opt.scale); }
    const n = values.length, series = blank(N); let rows = 0, year = null;
    if (times) {   // placed by time stamp (sub-hourly averaged, leap day dropped); several years: the chosen or the last one
      const yrs = {}; times.forEach(t => { if (t) yrs[t.y] = (yrs[t.y] || 0) + 1; });
      const ys = Object.keys(yrs).map(Number).filter(y => yrs[y] >= 0.5 * N).sort(); year = opt.year && yrs[opt.year] ? +opt.year : ys.length ? ys[ys.length - 1] : +Object.keys(yrs).sort((a, b) => yrs[b] - yrs[a])[0];
      const sumA = new Float64Array(N), cnt = new Float64Array(N);
      times.forEach((t, i) => { if (!t || t.y !== year) return; const idx = hourIndex(t.m, t.d, t.h); if (idx < 0 || !isFinite(values[i])) return; sumA[idx] += values[i]; cnt[idx]++; rows++; });
      for (let i = 0; i < N; i++) series[i] = cnt[i] ? sumA[i] / cnt[i] : NaN;
      if (ys.length > 1) notes.push(ys.length + ' years in the file (' + ys[0] + '–' + ys[ys.length - 1] + '): ' + year + ' used');
      if (rows > N + 24) notes.push('sub-hourly values averaged to hourly means');
      if (rows < 0.5 * N) throw new Error('only ' + rows + ' hours of ' + year + ' in the file');
      const tz = typeof opt.tz === 'number' ? opt.tz : null, lon = isFinite(opt.lon) ? +opt.lon : null;
      if (tz != null && lon != null) { const sh = Math.round(lon / 15 - tz); if (sh) { const r = roll(series, sh); for (let i = 0; i < N; i++) series[i] = r[i]; notes.push('shifted by ' + (sh > 0 ? '+' : '') + sh + ' h to local solar time'); } }
    } else {
      const leap = n === 8784 || n === 17568 || n === 35136, step = n % N === 0 ? n / N : leap ? n / 8784 : 0;
      if (step === 1 || step === 2 || step === 4) { const S2 = new Float64Array(N), C2 = new Float64Array(N); for (let i = 0; i < n; i++) { const hr = Math.floor(i / step); let idx = hr; if (leap) { if (hr >= 1416 && hr < 1440) continue; if (hr >= 1440) idx = hr - 24; } if (isFinite(values[i])) { S2[idx] += values[i]; C2[idx]++; } } for (let i = 0; i < N; i++) series[i] = C2[i] ? S2[i] / C2[i] : NaN; if (step > 1) notes.push(step + ' values per hour averaged'); if (leap) notes.push('leap day dropped'); }
      else if (n === 12) { let h = 0; for (let m = 0; m < 12; m++) for (let i = 0; i < DAYS[m] * 24; i++) series[h++] = values[m]; notes.push('12 monthly values expanded to the year'); }
      else if (n === 24) { for (let i = 0; i < N; i++) series[i] = values[i % 24]; notes.push('24 hourly values repeated for every day'); }
      else if (n === 168) { for (let i = 0; i < N; i++) series[i] = values[i % 168]; notes.push('one week of 168 values repeated'); }
      else if (n === 1) { series.fill(values[0]); notes.push('one value used for every hour'); }
      else throw new Error(n + ' values: a series needs 8760 hourly values (or 17 520 / 35 040 sub-hourly, 12 monthly, 24 daily-profile or 168 weekly values), or time stamps');
    }
    let valid = 0; for (let i = 0; i < N; i++) if (isFinite(series[i])) valid++;
    if (!valid) throw new Error('no numeric values in column "' + column + '"');
    for (let i = 0; i < N; i++) if (isFinite(series[i])) series[i] = Math.min(kind.max, Math.max(kind.min, series[i]));
    const filled = fillGaps(series, column);
    if (filled > 0) notes.push(filled + ' missing hours filled by interpolation');
    if (hint) notes.push('column "' + hint + '" used');
    return { series, kind: opt.kind || 'price', unit: kind.unit, column, columns: header, n, coverage: valid / N, filled, stats: H2.seriesStats(series, opt.kind), notes, year };
  };
  H2.seriesStats = function (a, kind) {
    const s = Array.from(a).sort((p, q) => p - q), n = s.length, q = p => s[Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))))];
    const st = { mean: mean(a), min: s[0], max: s[n - 1], p10: q(0.1), p50: q(0.5), p90: q(0.9), monthly: H2.monthly(a, (x, m) => x / m) };
    if (kind === 'price') { let low = 0, neg = 0; for (let i = 0; i < n; i++) { if (a[i] <= 20) low++; if (a[i] < 0) neg++; } st.hoursLE20 = low; st.hoursNeg = neg; }
    return st;
  };

  /* ---------- the site object of the design basis ---------- */
  // b.site = { weather: { name, source, file, lat, lon, elev, tz, ref_m, use, years: [{ label, year, ghi, tam, ws, dni?, dhi?, qc, stats }], notes, id },
  //            price: { name, source, unit, series, stats, notes, id }, ci: { … } } – plain arrays, so the project file stays JSON
  const packArr = (a, d) => Array.from(a, v => round(v, d));
  const hashArr = a => H2.seriesHash(a);
  /* a parsed weather import → the weather part of b.site (opt.use: index of the year to use, default the last) */
  H2.siteWeatherFromImport = function (imp, opt) {
    opt = opt || {}; const ys = imp.years.map(y => { const o = { label: y.label, year: y.year, rows: y.rows, ghi: packArr(y.ghi, 1), tam: packArr(y.tam, 1), ws: packArr(y.ws, 2), qc: y.qc, stats: y.stats }; if (y.dni) o.dni = packArr(y.dni, 1); if (y.dhi) o.dhi = packArr(y.dhi, 1); return o; });
    const w = { name: String(opt.name || imp.meta.name || imp.meta.file || 'Measured weather').slice(0, 120), source: String(imp.meta.source || imp.format).slice(0, 80), file: imp.meta.file ? String(imp.meta.file).slice(0, 120) : undefined, format: imp.format,
      lat: isFinite(imp.meta.lat) ? imp.meta.lat : undefined, lon: isFinite(imp.meta.lon) ? imp.meta.lon : undefined, elev: isFinite(imp.meta.elev) ? imp.meta.elev : undefined, tz: isFinite(imp.meta.tz) ? imp.meta.tz : undefined, ref_m: opt.ref_m > 0 ? +opt.ref_m : (imp.meta.ref_m || 10),
      use: Math.min(ys.length - 1, Math.max(0, opt.use == null ? ys.length - 1 : opt.use | 0)), years: ys, notes: imp.notes.slice(0, 20), imported: new Date().toISOString().slice(0, 10) };
    w.id = hashArr(ys.map(y => hashArr(y.ghi) + hashArr(y.tam) + hashArr(y.ws)));
    return w;
  };
  H2.siteSeriesFromImport = function (imp, opt) {
    opt = opt || {}; const o = { name: String(opt.name || imp.column || 'series').slice(0, 120), source: String(opt.source || opt.name || 'file').slice(0, 120), unit: imp.unit, column: imp.column, year: imp.year || undefined, series: packArr(imp.series, 3), stats: imp.stats, notes: imp.notes.slice(0, 20), imported: new Date().toISOString().slice(0, 10) };
    o.id = hashArr(o.series); return o;
  };
  /* validation of a site object (project files, scripts): { site, notes }; site is null when nothing usable remains.
     The result is kept per object (a solve normalises the basis every time; the optimiser thousands of times). */
  const cleaned = new WeakMap();
  H2.cleanSite = function (s) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return { site: null, notes: ['site data is not an object – ignored'] };
    const hit = cleaned.get(s); if (hit) return hit;
    const r = cleanSite(s); cleaned.set(s, r); if (r.site) cleaned.set(r.site, { site: r.site, notes: [] }); return r;
  };
  function cleanSite(s) {
    const notes = [], out = {};
    const arr = (a, n, lo, hi) => { if (!Array.isArray(a) && !ArrayBuffer.isView(a)) return null; if (a.length !== n) return null; const o = new Array(n); for (let i = 0; i < n; i++) { const v = Number(a[i]); if (!isFinite(v)) return null; o[i] = Math.min(hi, Math.max(lo, v)); } return o; };
    const str = (v, n) => (v == null ? undefined : String(v).slice(0, n));
    const numOr = (v, lo, hi) => { const x = Number(v); return isFinite(x) ? Math.min(hi, Math.max(lo, x)) : undefined; };
    if (s.weather) {
      const w = s.weather, years = [];
      (Array.isArray(w.years) ? w.years : []).slice(0, MAX_YEARS).forEach((y, i) => {
        if (!y || typeof y !== 'object') return; const ghi = arr(y.ghi, N, 0, 1500), tam = arr(y.tam, N, -60, 60), ws = arr(y.ws, N, 0, 60);
        if (!ghi || !tam || !ws) { notes.push('weather year ' + (y.label || i + 1) + ' is incomplete – dropped'); return; }
        const o = { label: str(y.label, 20) || String(i + 1), year: isFinite(+y.year) ? +y.year : 0, ghi, tam, ws }; const dni = arr(y.dni, N, 0, 1400), dhi = arr(y.dhi, N, 0, 1000); if (dni) o.dni = dni; if (dhi) o.dhi = dhi;
        if (y.qc && typeof y.qc === 'object') o.qc = y.qc; o.stats = y.stats && typeof y.stats === 'object' ? y.stats : H2.weatherStats({ ghi: Float64Array.from(ghi), tam: Float64Array.from(tam), ws: Float64Array.from(ws) });
        if (isFinite(+y.rows)) o.rows = +y.rows; years.push(o);
      });
      if (years.length) {
        out.weather = { name: str(w.name, 120) || 'Measured weather', source: str(w.source, 80) || 'file', file: str(w.file, 120), format: str(w.format, 20), lat: numOr(w.lat, -90, 90), lon: numOr(w.lon, -180, 180), elev: numOr(w.elev, -500, 9000), tz: numOr(w.tz, -12, 14), ref_m: numOr(w.ref_m, 1, 300) || 10,
          use: Math.min(years.length - 1, Math.max(0, (w.use | 0))), years, notes: Array.isArray(w.notes) ? w.notes.slice(0, 20).map(x => String(x).slice(0, 200)) : [], imported: str(w.imported, 10) };
        out.weather.id = hashArr(years.map(y => hashArr(y.ghi) + hashArr(y.tam) + hashArr(y.ws)));
      } else notes.push('measured weather without a usable year – the synthetic year is used');
    }
    ['price', 'ci'].forEach(k => {
      const p = s[k]; if (!p) return; const kind = H2.SERIES_KINDS[k]; const series = p && typeof p === 'object' ? arr(p.series, N, kind.min, kind.max) : null;
      if (!series) { notes.push(kind.label + ' series is incomplete – ignored'); return; }
      out[k] = { name: str(p.name, 120) || kind.label, source: str(p.source, 120) || 'file', unit: kind.unit, column: str(p.column, 80), year: isFinite(+p.year) ? +p.year : undefined, series, stats: p.stats && typeof p.stats === 'object' ? p.stats : H2.seriesStats(series, k), notes: Array.isArray(p.notes) ? p.notes.slice(0, 20).map(x => String(x).slice(0, 200)) : [], imported: str(p.imported, 10), id: hashArr(series) };
    });
    return { site: Object.keys(out).length ? out : null, notes };
  }
  /* accessors used by the solver */
  H2.siteWeather = function (b) {
    const s = b && b.site && b.site.weather; if (!s || !Array.isArray(s.years) || !s.years.length) return null;
    const i = Math.min(s.years.length - 1, Math.max(0, s.use | 0)), y = s.years[i];
    return { ghi: y.ghi, tam: y.tam, ws: y.ws, dni: y.dni || null, dhi: y.dhi || null, id: (s.id || 'site') + ':' + i, ref_m: s.ref_m || 10, name: s.name, label: y.label, year: y.year, index: i, count: s.years.length, stats: y.stats, qc: y.qc };
  };
  H2.siteYears = b => (b && b.site && b.site.weather && Array.isArray(b.site.weather.years) ? b.site.weather.years.length : 0);
  H2.siteUse = (site, i) => Object.assign({}, site, { weather: Object.assign({}, site.weather, { use: i }) });
  H2.siteSeries = function (b, kind) { const s = b && b.site && b.site[kind]; return s && s.series && s.series.length === N ? s : null; };
  /* a short description of the site data of a basis, for reports */
  H2.siteInfo = function (b) {
    const w = H2.siteWeather(b), p = H2.siteSeries(b, 'price'), c = H2.siteSeries(b, 'ci'); if (!w && !p && !c) return null;
    const info = {};
    if (w) info.weather = { name: w.name, source: b.site.weather.source, label: w.label, years: w.count, ref_m: w.ref_m, lat: b.site.weather.lat, lon: b.site.weather.lon, stats: w.stats, qc: w.qc, imported: b.site.weather.imported };
    if (p) info.price = { name: p.name, source: p.source, stats: p.stats, year: p.year, imported: p.imported };
    if (c) info.ci = { name: c.name, source: c.source, stats: c.stats, year: c.year, imported: c.imported };
    return info;
  };
  /* the design-basis values that follow from a measured year: latitude, annual GHI, mean wind at the hub height
     (power law, Eq. 4.6), Weibull k, mean temperature – written into the basis together with the site data */
  H2.siteBasisValues = function (w, b) {
    const st = w.stats || {}, L = H2.BASIS_LIMITS, clamp = (k, v) => (L[k] ? Math.min(L[k][1], Math.max(L[k][0], v)) : v), out = {};
    if (isFinite(w.lat)) out.lat = clamp('lat', round(w.lat, 2));
    if (st.GHI > 0) out.GHI = clamp('GHI', Math.round(st.GHI));
    const hub = b && b.hubHeight > 0 ? b.hubHeight : 100, alpha = b && b.windAlpha != null ? b.windAlpha : 0.14, ref = w.ref_m || 10;
    if (st.v_mean > 0) out.vmean = clamp('vmean', round(st.v_mean * Math.pow(hub / ref, alpha), 2));
    if (st.k > 0) out.windK = clamp('windK', round(st.k, 2));
    if (isFinite(st.T_mean)) out.T_mean = clamp('T_mean', round(st.T_mean, 1));
    return out;
  };

  /* ---------- price-following grid operation: the lowest cap that reaches a production ---------- */
  /* bisection over the price cap of gridMode "price" (the production rises with the cap); o: { target (t/a), tol, maxIter } */
  H2.priceCapFor = function (basis, o) {
    o = o || {}; const b0 = H2.normalizeBasis(basis).b, T = o.target > 0 ? o.target : H2.optimizeTarget ? H2.optimizeTarget(b0) : b0.demand * 0.365;
    const sp = H2.siteSeries(b0, 'price'); const lo = sp ? Math.min.apply(null, sp.series) : b0.pel - 1, hi = sp ? Math.max.apply(null, sp.series) : b0.pel;
    const f = cap => { const s = H2.solveSystem(Object.assign({}, b0, { gridMode: 'price', gridPriceCap: cap })); return { H2_t: s.kpi.H2_t, LCOH: s.kpi.LCOH, cap }; };
    let solves = 0; const top = f(hi); solves++;
    if (top.H2_t < T) return Object.assign(top, { target: T, feasible: false, solves, note: 'even unrestricted grid import does not reach the target' });
    const bottom = f(lo - 1); solves++;
    if (bottom.H2_t >= T) return Object.assign(bottom, { target: T, feasible: true, solves, note: 'the target is reached without grid import for production' });
    let a = lo - 1, bb = hi, best = top; const tol = o.tol || 0.1;
    for (let i = 0; i < (o.maxIter || 20) && bb - a > tol; i++) { const mid = (a + bb) / 2, r = f(mid); solves++; if (r.H2_t >= T) { bb = mid; best = r; } else a = mid; }
    return Object.assign({}, best, { cap: round(bb, 1), target: T, feasible: true, solves });
  };

  if (typeof module !== 'undefined') module.exports = H2;
})(typeof window !== 'undefined' ? window : globalThis);

;
/* Hasim – Green Hydrogen Engineering Suite. © 2026 Prof. Hani Muhsen. All rights reserved. */
/* =====================================================================
   Hasim – engine-policy.js (Hasim 3.0): policy packs – incentives and carbon pricing in the return on investment
   Capital grants and investment credits, production premiums (fixed, declining, by carbon-intensity tier,
   contracts for difference) over a support period, a carbon price on the plant's operational emissions and a
   credit for the emissions avoided against grey hydrogen: the levelised cost after incentives, the yearly cash
   flows with NPV, IRR and discounted payback (Muhsen 2026, Eq. 13.4 and 13.13), the abatement cost against grey
   hydrogen (Eq. 13.29) and the break-even carbon price. The LCOH of the design stays the engineering cost; the
   policy figures are shown beside it. Presets carry their sources and dates and are meant to be checked and edited.
   Nothing here is taken from any other simulation software.
   Owner and developer: Prof. Hani Muhsen.
   ===================================================================== */
(function (root) {
  'use strict';
  const H2 = root.H2;
  const AF = (r, n) => (Math.abs(r) < 1e-9 ? n : (1 - Math.pow(1 + r, -n)) / r);   // annuity factor (present value of 1 per year)
  H2.POLICY_DEFAULTS = { policyPack: 'none', grantFrac: 0, grantMEUR: 0, premium: 0, premiumYears: 10, premiumDecline: 0, premiumTier: 'off', fxUSD: 0.92, cfdStrike: 0, co2Price: 0, co2Credit: 'off', greyPrice: 2, greyCI: 10 };
  H2.POLICY_LIMITS = { grantFrac: [0, 0.9], grantMEUR: [0, 1e4], premium: [-20, 20], premiumYears: [1, 30, 1], premiumDecline: [0, 5], fxUSD: [0.3, 3], cfdStrike: [0, 50], co2Price: [0, 1000], greyPrice: [0, 20], greyCI: [0, 30] };
  H2.POLICY_OPTIONS = { premiumTier: ['off', '45V'], co2Credit: ['off', 'avoided'] };
  // US § 45V tiers (kg CO₂e per kg H₂, lifecycle well-to-gate) and the 2025 credit amounts with prevailing wage (USD/kg): CRS IF12602
  H2.TIERS_45V = [[0.45, 3.185, '< 0.45'], [1.5, 1.065, '0.45–1.5'], [2.5, 0.795, '1.5–2.5'], [4.0, 0.635, '2.5–4.0']];
  H2.tier45V = ci => { for (const t of H2.TIERS_45V) if (ci < t[0] || (t[0] === 4.0 && ci <= 4.0)) return { usd: t[1], band: t[2], share: t[1] / H2.TIERS_45V[0][1] }; return { usd: 0, band: '> 4.0 – not eligible', share: 0 }; };
  /* presets – values are indicative and dated; the fields are editable, and each pack names its source */
  H2.POLICY_PACKS = [
    { id: 'none', name: 'No incentives', set: { grantFrac: 0, grantMEUR: 0, premium: 0, premiumDecline: 0, premiumTier: 'off', cfdStrike: 0, co2Price: 0, co2Credit: 'off' }, note: 'The ROI uses the hydrogen value of the design basis alone.' },
    { id: 'eu-h2bank', name: 'EU – European Hydrogen Bank auction (fixed premium, 10 years)', set: { grantFrac: 0, grantMEUR: 0, premium: 0.5, premiumYears: 10, premiumDecline: 0, premiumTier: 'off', cfdStrike: 0 },
      note: 'Pay-as-bid fixed premium per kg of RFNBO hydrogen for up to 10 years (Innovation Fund). First auction (2023/24, €800 M): ceiling 4.5 EUR/kg, awards 0.37–0.48 EUR/kg; second (2024/25, €1.2 B): ceiling 4 EUR/kg; third launched Dec 2025 (€1.3 B). Enter your bid as the premium.', source: 'https://observatory.clean-hydrogen.europa.eu/eu-policy/european-hydrogen-bank' },
    { id: 'us-45v', name: 'US – § 45V clean hydrogen production credit (by CI tier, 10 years)', set: { grantFrac: 0, grantMEUR: 0, premium: 0, premiumYears: 10, premiumDecline: 0, premiumTier: '45V', cfdStrike: 0 },
      note: '2025 amounts with prevailing wage and apprenticeship: 3.185 USD/kg below 0.45 kg CO₂e/kg, 1.065 (0.45–1.5), 0.795 (1.5–2.5), 0.635 (2.5–4.0); inflation-adjusted; 10 years from placing in service; construction must begin before 1 January 2028 (P.L. 119-21); hourly matching of the electricity from 2030. The tier follows the plant\'s carbon intensity (grid share of the electricity).', source: 'https://crsreports.congress.gov/product/pdf/IF/IF12602' },
    { id: 'us-48', name: 'US – § 48(a)(15) investment credit election (up to 30 % of the facility cost by CI tier)', set: { grantFrac: 0.30, grantMEUR: 0, premium: 0, premiumDecline: 0, premiumTier: 'off', cfdStrike: 0 },
      note: 'Instead of § 45V a facility may elect the energy investment credit: 30 % (with prevailing wage) for hydrogen below 0.45 kg CO₂e/kg, 10 % (0.45–1.5), 7.5 % (1.5–2.5), 6 % (2.5–4.0) of the qualified investment. The grant share is set for the lowest tier – set it to the tier of your plant; the same construction deadline applies.', source: 'https://crsreports.congress.gov/product/pdf/IF/IF12602' },
    { id: 'in-sight', name: 'India – SIGHT scheme, Mode 1 (declining premium, 3 years)', set: { grantFrac: 0, grantMEUR: 0, premium: 0.55, premiumYears: 3, premiumDecline: 0.11, premiumTier: 'off', cfdStrike: 0 },
      note: 'National Green Hydrogen Mission, Strategic Interventions for Green Hydrogen Transition: production incentive of up to 50, 40 and 30 INR/kg in years 1 to 3 (about 0.55, 0.44 and 0.33 EUR/kg), awarded by competitive bidding. Enter the awarded values.', source: 'https://mnre.gov.in/national-green-hydrogen-mission/' },
    { id: 'cfd', name: 'Contract for difference (strike price for the support period)', set: { grantFrac: 0, grantMEUR: 0, premium: 0, premiumDecline: 0, premiumTier: 'off', cfdStrike: 8, premiumYears: 10 },
      note: 'A two-sided CfD pays the difference between the strike price and the hydrogen value for the support period (Germany\'s H2Global and the UK Hydrogen Production Business Model work this way): the hydrogen earns the strike price for those years.' },
    { id: 'carbon', name: 'Carbon price on operational emissions, credit for avoided emissions', set: { co2Price: 70, co2Credit: 'avoided' },
      note: 'A carbon price (EU ETS allowances traded around 60–80 EUR/t in 2024–2025) on the grid-electricity emissions of the plant, and a credit for the emissions avoided against grey hydrogen (SMR, about 10 kg CO₂e/kg, CM 18.2) at the same price – the value a refinery or ammonia plant under the ETS places on green hydrogen.', source: 'https://www.eex.com/en/market-data/environmental-markets/eua-primary-auction' }
  ];
  H2.policyPack = id => (id === 'custom' ? { id: 'custom', name: 'Custom combination of the incentive fields', set: {}, note: 'Your own combination of the fields below.' } : H2.POLICY_PACKS.find(p => p.id === id) || H2.POLICY_PACKS[0]);

  /* the premium per kg in year t (1 … N) of a basis, given the hydrogen value and the carbon intensity */
  H2.policyPremium = function (b, t, value, ci) {
    if (t > (b.premiumYears || 0)) return 0;
    let p = 0;
    if (b.cfdStrike > 0) p += b.cfdStrike - value;                                               // two-sided CfD: the strike replaces the market value
    if (b.premiumTier === '45V') p += H2.tier45V(ci).usd * (b.fxUSD || 0.92);
    p += Math.max(0, (b.premium || 0) - (b.premiumDecline || 0) * (t - 1)) + Math.min(0, b.premium || 0);
    return p;
  };
  /* the policy evaluation of a solved system: sys = H2.solveSystem(...) (its annual KPIs carry the cost build-up) */
  H2.policyEval = function (sys, bIn) {
    const b = Object.assign({}, H2.POLICY_DEFAULTS, bIn || sys.basis), A = sys.annual.kpi, bd = sys.annual.breakdown;
    const mH = Math.max(A.H2_t, 1e-9), N = Math.max(1, Math.round(sys.cfg.econ.life || b.life || 25)), i = sys.cfg.econ.WACC != null ? sys.cfg.econ.WACC : b.WACC;
    const CRF = A.CRF, invest = A.CAPEX_MEUR + (A.PVstacks_MEUR || 0) + (A.PVrepl_MEUR || 0);
    const byprod = -(bd['by-products'] || 0) * mH / 1e3, running = (A.opex_MEUR || 0) + (A.elec_MEUR || 0) + (A.heat_MEUR || 0) + (A.water_MEUR || 0) - byprod;   // MEUR/a
    const LCOH = A.LCOH, value = b.h2Price || 0, ci = A.CI_kgkg;
    const grant = Math.min(invest, (b.grantFrac || 0) * A.CAPEX_MEUR + (b.grantMEUR || 0));
    const carbonCost = (b.co2Price || 0) * ci / 1000, carbonCredit = b.co2Credit === 'avoided' ? (b.co2Price || 0) * Math.max(0, (b.greyCI == null ? 10 : b.greyCI) - ci) / 1000 : 0;   // EUR/kg
    const prem = []; let pvPrem = 0; for (let t = 1; t <= N; t++) { const p = H2.policyPremium(b, t, value, ci); prem.push(p); pvPrem += p * Math.pow(1 + i, -t); }
    const premiumLev = pvPrem / AF(i, N);                                                       // constant premium with the same present value
    const grantLev = 1e3 * CRF * grant / mH;                                                    // EUR/kg
    const LCOHp = LCOH - grantLev - premiumLev + carbonCost - carbonCredit;
    // yearly cash flows at the hydrogen value, with and without the pack (Eq. 13.4, 13.13)
    const flows = (withPolicy) => { const cf = [-(invest - (withPolicy ? grant : 0))]; for (let t = 1; t <= N; t++) cf.push((value + (withPolicy ? prem[t - 1] - carbonCost + carbonCredit : 0)) * mH / 1e3 - running); return cf; };
    const npv = (cf, r) => cf.reduce((s, v, t) => s + v / Math.pow(1 + r, t), 0);
    const irr = cf => { if (!(cf[0] < 0) || cf.slice(1).every(v => v <= 0)) return null; let lo = -0.99, hi = 5; if (npv(cf, lo) < 0) return null; for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (npv(cf, mid) > 0) lo = mid; else hi = mid; } return (lo + hi) / 2; };
    const payback = (cf, r) => { let acc = cf[0]; for (let t = 1; t < cf.length; t++) { const d = cf[t] / Math.pow(1 + r, t); if (acc + d >= 0) return t - 1 + (d > 0 ? -acc / d : 0); acc += d; } return null; };
    const cfB = flows(false), cfP = flows(true), cumB = [], cumP = []; let aB = 0, aP = 0; cfB.forEach((v, t) => { aB += v / Math.pow(1 + i, t); cumB.push(aB); }); cfP.forEach((v, t) => { aP += v / Math.pow(1 + i, t); cumP.push(aP); });
    const base = { NPV: npv(cfB, i), IRR: irr(cfB), payback: payback(cfB, i) }, pol = { NPV: npv(cfP, i), IRR: irr(cfP), payback: payback(cfP, i) };
    // support: present value of grant, premiums and carbon credits less the carbon cost; abatement cost and break-even carbon price against grey hydrogen (Eq. 13.29)
    const pvSupport = grant + pvPrem * mH / 1e3 + (carbonCredit - carbonCost) * mH / 1e3 * AF(i, N), pvH2 = mH * AF(i, N);   // MEUR, t
    const grey = b.greyPrice == null ? 2 : b.greyPrice, greyCI = b.greyCI == null ? 10 : b.greyCI, LCOHx = LCOH - grantLev - premiumLev;   // after grants and premiums, before carbon pricing
    const abatement = greyCI > ci ? (LCOH - grey) / (greyCI - ci) * 1000 : null, abatementP = greyCI > ci ? (LCOHx - grey) / (greyCI - ci) * 1000 : null;   // EUR/t CO₂e – also the break-even carbon price
    const active = grant > 0 || prem.some(p => p !== 0) || carbonCost > 0 || carbonCredit > 0;
    return { pack: b.policyPack || 'none', active, value, N, i, mH, CI: ci, grant, grantLev, premium: prem[0] || 0, premiumYears: Math.min(N, b.premiumYears || 0), premiumLev, premiums: prem, tier45: b.premiumTier === '45V' ? H2.tier45V(ci) : null,
      carbonCost, carbonCredit, co2Price: b.co2Price || 0, LCOH, LCOH_policy: LCOHp, base, policy: pol, cashflows: cfB, cashflowsPolicy: cfP, cumulative: cumB, cumulativePolicy: cumP,
      support_MEUR: pvSupport, support_perkg: pvH2 > 0 ? 1e3 * pvSupport / pvH2 : 0, grey, greyCI, LCOH_support: LCOHx, abatement, abatementPolicy: abatementP, breakEvenCO2: abatement, breakEvenCO2Policy: abatementP, running, invest };
  };
  if (typeof module !== 'undefined') module.exports = H2;
})(typeof window !== 'undefined' ? window : globalThis);

;
/* Hasim – Green Hydrogen Engineering Suite. © 2026 Prof. Hani Muhsen. All rights reserved. */
/* =====================================================================
   Hasim – engine-optimise.js (Hasim 3.0)
   Plant sizing by differential evolution around the complete system model.
     variables   electrolyser modules, PV, wind, battery power and duration, storage buffer, grid import limit
     objective   lowest LCOH, highest margin at a hydrogen value (CM 17.3; Muhsen 2026, Smart Grids and Microgrids, Eq. 7.40),
                 or the P90 of the LCOH over several synthetic weather years
     constraints the design checks of the solver (demand, RFNBO carbon intensity, unserved auxiliary energy), optional
                 ε-limits on carbon intensity and water, handled by the feasibility rule of Deb (2000): a feasible design
                 beats an infeasible one, among feasible designs the lower objective wins, among infeasible ones the
                 smaller violation
     search      DE/rand/1/bin (Storn & Price 1997; Muhsen 2026, Eq. 14.55) with F = 0.6, CR = 0.8, NP = 10 n, started from a
                 Latin-hypercube screen (McKay, Beckman & Conover 1979) that includes the current design; integers rounded
                 on evaluation; stopped after a fixed number of generations or when the best objective stalls; repeated for
                 several seeds; the best design polished by Nelder–Mead (1965) on the continuous variables
   The algorithm is written as a generator that hands out batches of design bases and takes back their summaries,
   so the same code runs serially (H2.optimizeSync), in the page with yields, or on a worker pool (H2.optimize).
   Author and owner: Prof. Hani Muhsen.
   ===================================================================== */
(function (root) {
  'use strict';
  const H2 = root.H2;
  const own = H2.own;
  const RFNBO_CI = 3.38, NO_SOLUTION = 1e9;                   // violation of a design the solver cannot evaluate: worse than any finite one                                       // kg CO₂e/kg, Delegated Regulation (EU) 2023/1185 (70 % below 94 g/MJ)
  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  const nice = (v, d) => { if (!(v > 0)) return 0; const m = Math.pow(10, Math.floor(Math.log10(v)) - (d || 2) + 1); return Math.round(v / m) * m; };

  /* ---------------- decision variables ---------------- */
  // every variable of the search space with its default bounds for a given design basis
  H2.optimizeVars = function (b) {
    b = H2.completeBasis(b);
    const P = b.modules * b.moduleMW, isl = b.supply === 'islanded';
    const up = (v, ref) => nice(2.5 * Math.max(v || 0, ref), 2);
    const vars = [
      { key: 'modules', label: 'Electrolyser modules', unit: '–', integer: true, min: Math.max(1, Math.round(0.5 * b.modules)), max: Math.min(200, Math.ceil(2.5 * b.modules)), value: b.modules, enabled: true },
      { key: 'pvMWp', label: 'PV capacity', unit: 'MWp', min: 0, max: up(b.pvMWp, 2 * P), value: b.pvMWp, enabled: b.pvMWp > 0 },
      { key: 'windMW', label: 'Wind capacity', unit: 'MW', min: 0, max: up(b.windMW, 1.5 * P), value: b.windMW, enabled: b.windMW > 0 },
      { key: 'batMW', label: 'Battery power', unit: 'MW', min: 0, max: up(b.batMW, 0.5 * P), value: b.batMW, enabled: b.batMW > 0 },
      { key: 'batHours', label: 'Battery duration', unit: 'h', min: 1, max: 8, value: b.batMW > 0 ? +(b.batMWh / b.batMW).toFixed(2) : 2, enabled: b.batMW > 0 }
    ];
    if (b.storeSizing === 'days') vars.push({ key: 'storeDays', label: 'Storage buffer', unit: 'd', min: 0.05, max: Math.max(2, Math.min(30, 4 * (b.storeDays || 1))), value: b.storeDays, enabled: true });
    if (!isl) vars.push({ key: 'gridMW', label: 'Grid import limit', unit: 'MW', min: 0, max: up(b.gridMW, 1.5 * P), value: b.gridMW, enabled: b.gridMW > 0 });
    return vars;
  };
  H2.OBJECTIVES = [
    { id: 'lcoh', label: 'Lowest LCOH', unit: 'EUR/kg', minimize: true },
    { id: 'margin', label: 'Highest margin at the hydrogen value', unit: 'MEUR/a', minimize: false },
    { id: 'p90', label: 'Lowest P90 LCOH over several weather years', unit: 'EUR/kg', minimize: true }
  ];
  // the yearly hydrogen the demand asks for, t/a (DM 1.1 / CM 1.4; ammonia demand via the loop yield, DM 15.2)
  const targetH2 = b => (b.product === 'NH3' ? b.demand * H2.NH3.h2 / H2.NH3.loop : b.demand * 365 / 1000);

  /* decode a point of the unit cube into design-basis changes */
  function decode(x, vars, b0) {
    const ch = {};
    vars.forEach((v, j) => { let val = v.min + clamp01(x[j]) * (v.max - v.min); if (v.integer) val = Math.round(val); else val = +val.toPrecision(5); ch[v.key] = val; });
    if ('batHours' in ch || 'batMW' in ch) { const pw = 'batMW' in ch ? ch.batMW : b0.batMW, hrs = 'batHours' in ch ? ch.batHours : (b0.batMW > 0 ? b0.batMWh / b0.batMW : 2); ch.batMWh = +(pw * hrs).toPrecision(5); delete ch.batHours; }
    return ch;
  }
  function encode(b, vars) { return vars.map(v => { const val = v.key === 'batHours' ? (b.batMW > 0 ? b.batMWh / b.batMW : 2) : b[v.key]; return v.max > v.min ? clamp01(((val == null ? v.min : val) - v.min) / (v.max - v.min)) : 0; }); }

  /* objective and constraint violation of one evaluated design (its summary, or summaries over several years) */
  function judge(sums, b0, o) {
    const T = targetH2(b0), c = o.constraints || {};
    const one = s => {
      if (!s || s.error || !s.kpi || !(s.kpi.H2_t > 1e-6 * T) || !isFinite(s.kpi.LCOH)) return { obj: Infinity, viol: NO_SOLUTION, fails: ['no solution'] };
      const k = s.kpi, a = s.annual, fails = []; let viol = 0;
      if (c.demand !== false && k.H2_t < 0.97 * T) { viol += (0.97 * T - k.H2_t) / T; fails.push('demand'); }
      if (c.demandMax != null && c.demandMax > 0 && k.H2_t > c.demandMax * T) { viol += (k.H2_t - c.demandMax * T) / T; fails.push('overproduction'); }
      if (c.rfnbo !== false && k.CI > RFNBO_CI) { viol += (k.CI - RFNBO_CI) / RFNBO_CI; fails.push('RFNBO'); }
      if (c.aux !== false && a.unmet_MWh > 1e-6) { viol += a.unmet_MWh / Math.max(1, (a.E_aux_GWh || 0) * 1000); fails.push('auxiliaries'); }
      if (c.ciMax != null && k.CI > c.ciMax) { viol += (k.CI - c.ciMax) / Math.max(0.1, c.ciMax); fails.push('CI limit'); }
      if (c.waterMax != null) { const w = a.V_raw_m3a / Math.max(1e-9, k.H2_t); if (w > c.waterMax) { viol += (w - c.waterMax) / Math.max(1, c.waterMax); fails.push('water limit'); } }
      if (c.allChecks) { const other = s.fails.filter(n => !/vs demand|RFNBO|Unserved auxiliary/.test(n)); viol += 0.05 * other.length; other.forEach(n => fails.push(n)); }
      const obj = o.objective === 'margin' ? -((o.h2Value - k.LCOH) * k.H2_t * 1000) / 1e6 : k.LCOH;
      return { obj, viol, fails };
    };
    if (sums.length === 1) return one(sums[0]);
    const js = sums.map(one), objs = js.map(j => j.obj).filter(isFinite).sort((p, q) => p - q);
    if (!objs.length) return { obj: Infinity, viol: NO_SOLUTION, fails: ['no solution'] };
    const q = 0.9 * (objs.length - 1), i = Math.floor(q), p90 = objs[i] + (objs[Math.min(objs.length - 1, i + 1)] - objs[i]) * (q - i);
    return { obj: o.objective === 'p90' ? p90 : objs.reduce((s, v) => s + v, 0) / objs.length, viol: js.reduce((s, j) => s + j.viol, 0) / js.length, fails: [...new Set(js.flatMap(j => j.fails))] };
  }
  // Deb's feasibility rule: true when a is better than b
  const better = (a, b) => (a.viol <= 0 && b.viol <= 0 ? a.obj < b.obj : a.viol <= 0 ? true : b.viol <= 0 ? false : a.viol < b.viol);

  /* ---------------- the algorithm as a generator of evaluation batches ---------------- */
  // settings with their defaults
  H2.optimizeDefaults = () => ({ objective: 'lcoh', h2Value: 6, constraints: { demand: true, demandMax: 1.1, rfnbo: true, aux: true, allChecks: false, ciMax: null, waterMax: null },
    seeds: 3, generations: 60, minGenerations: 15, popSize: 0, F: 0.6, CR: 0.8, patience: 15, tol: 1e-3, polish: true, polishEvals: 100, p90Years: 5, maxEvals: 20000, seed: 1 });

  function* algorithm(b0, o, vars, state) {
    // P90: several synthetic years (seeds) – or, with several measured years imported (engine-site.js), those years
    // (a single measured year cannot vary: the synthetic years of its statistics are used, prices and carbon series kept)
    const measured = H2.siteYears ? H2.siteYears(b0) : 0, useMeasured = o.objective === 'p90' && measured >= 2;
    const n = vars.length, NP = o.popSize || Math.max(20, 10 * n), years = o.objective === 'p90' ? (useMeasured ? Math.min(measured, Math.max(2, o.p90Years | 0)) : Math.max(2, o.p90Years | 0)) : 1;
    const noWeather = (() => { if (!(measured === 1 && years > 1)) return null; const s = Object.assign({}, b0.site); delete s.weather; return Object.keys(s).length ? s : undefined; })();
    const memo = new Map();                 // decoded design → record (DE revisits integer combinations)
    const log = [];
    const mkBases = ch => { const out = []; for (let y = 0; y < years; y++) out.push(Object.assign({}, b0, ch, years > 1 ? (useMeasured ? { site: H2.siteUse(b0.site, measured - years + y) } : Object.assign({ seed: ((b0.seed || 1) + y - 1) % 9999 + 1 }, measured === 1 ? { site: noWeather } : {})) : {})); return out; };
    // evaluate a list of points: yields one batch of bases, returns records in order
    function* evaluate(points, phase, gen, seedNo) {
      const todo = [], recs = new Array(points.length);
      points.forEach((x, i) => { const ch = decode(x, vars, b0), key = JSON.stringify(ch); const m = memo.get(key); if (m) recs[i] = Object.assign({}, m, { x: x.slice(), reused: true }); else todo.push({ i, x, ch, key }); });
      if (todo.length) {
        const bases = []; todo.forEach(t => mkBases(t.ch).forEach(b => bases.push(b)));
        if (state.evals + bases.length > o.maxEvals) { state.stop = 'evaluation budget'; }
        const sums = yield bases; state.evals += bases.length;
        todo.forEach((t, j) => { const ss = sums.slice(j * years, (j + 1) * years), jd = judge(ss, b0, o);
          const rec = { x: t.x.slice(), v: t.ch, obj: jd.obj, viol: jd.viol, feasible: jd.viol <= 0, fails: jd.fails, summary: ss[0], years: years > 1 ? ss : null, phase, gen, seed: seedNo, id: log.length };
          memo.set(t.key, rec); recs[t.i] = rec; log.push(rec); });
      }
      return recs;
    }
    const runs = []; let bestAll = null;
    for (let s = 0; s < o.seeds && !state.stop; s++) {
      const seedNo = (o.seed || 1) + s, R = H2.rng(seedNo * 7919 + 17);
      // Latin hypercube start, the current design as member 0
      const pop = []; const strata = vars.map(() => { const p = []; for (let i = 0; i < NP; i++) p.push(i); for (let i = NP - 1; i > 0; i--) { const j = Math.floor(R.u() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return p; });
      for (let i = 0; i < NP; i++) pop.push(vars.map((v, j) => (strata[j][i] + R.u()) / NP));
      pop[0] = encode(b0, vars);
      let recs = yield* evaluate(pop, 'screen', 0, seedNo);
      let best = recs.reduce((a, r) => (better(r, a) ? r : a), recs[0]), stall = 0, gen = 0; const hist = [snap(0, recs, best)];
      state.report({ phase: 'de', seed: seedNo, run: s + 1, gen: 0, best, hist });
      for (gen = 1; gen <= o.generations && !state.stop; gen++) {
        const trial = [];
        for (let i = 0; i < NP; i++) {
          let r1, r2, r3; do r1 = Math.floor(R.u() * NP); while (r1 === i); do r2 = Math.floor(R.u() * NP); while (r2 === i || r2 === r1); do r3 = Math.floor(R.u() * NP); while (r3 === i || r3 === r1 || r3 === r2);
          const jr = Math.floor(R.u() * n), u = new Array(n);
          for (let j = 0; j < n; j++) u[j] = (R.u() < o.CR || j === jr) ? clamp01(pop[r1][j] + o.F * (pop[r2][j] - pop[r3][j])) : pop[i][j];
          trial.push(u);
        }
        const tr = yield* evaluate(trial, 'de', gen, seedNo);
        let improved = false;
        for (let i = 0; i < NP; i++) if (better(tr[i], recs[i])) { recs[i] = tr[i]; pop[i] = tr[i].x; if (better(tr[i], best)) { if (best.feasible && tr[i].feasible && Math.abs(best.obj - tr[i].obj) > o.tol * Math.abs(best.obj)) improved = true; else if (!best.feasible) improved = true; best = tr[i]; } }
        stall = improved ? 0 : stall + 1;
        hist.push(snap(gen, recs, best));
        state.report({ phase: 'de', seed: seedNo, run: s + 1, gen, best, hist });
        if (stall >= o.patience && gen >= o.minGenerations) break;
      }
      let polished = null;
      if (o.polish && best.feasible && !state.stop) {
        const cont = vars.map((v, j) => (v.integer ? -1 : j)).filter(j => j >= 0);
        if (cont.length) { polished = yield* nelderMead(best, cont, evaluate, seedNo); if (better(polished, best)) best = polished; }
      }
      runs.push({ seed: seedNo, best, generations: gen - 1, stalled: stall >= o.patience, history: hist, polished: !!polished });
      if (!bestAll || better(best, bestAll)) bestAll = best;
    }
    return { best: bestAll, runs, log };
    function snap(gen, recs, best) { const f = recs.filter(r => r.feasible); return { gen, best: best.feasible ? best.obj : null, viol: best.viol, feasible: f.length / recs.length, mean: f.length ? f.reduce((s, r) => s + r.obj, 0) / f.length : null, evals: state.evals }; }
    // Nelder–Mead on the continuous coordinates, the others fixed at the best design; infeasible points are penalised
    function* nelderMead(start, dims, evaluate, seedNo) {
      const pen = r => (r.feasible ? r.obj : start.obj + 1e3 * (1 + r.viol));
      const mk = (base, dim, delta) => { const x = base.slice(); x[dim] = clamp01(x[dim] + delta); return x; };
      let simplex = [start]; const init = dims.map(d => mk(start.x, d, start.x[d] > 0.5 ? -0.05 : 0.05));
      const r0 = yield* evaluate(init, 'polish', 0, seedNo); simplex = simplex.concat(r0);
      let evals = init.length; const nn = dims.length;
      while (evals < o.polishEvals && !state.stop) {
        simplex.sort((a, b) => pen(a) - pen(b));
        const worst = simplex[nn], cen = start.x.slice();
        dims.forEach(d => { cen[d] = simplex.slice(0, nn).reduce((s, p) => s + p.x[d], 0) / nn; });
        const pt = (from, f) => { const x = start.x.slice(); dims.forEach(d => { x[d] = clamp01(cen[d] + f * (from.x[d] - cen[d])); }); return x; };
        const [refl] = yield* evaluate([pt(worst, -1)], 'polish', 0, seedNo); evals++;
        if (pen(refl) < pen(simplex[0])) { const [exp] = yield* evaluate([pt(worst, -2)], 'polish', 0, seedNo); evals++; simplex[nn] = pen(exp) < pen(refl) ? exp : refl; }
        else if (pen(refl) < pen(simplex[nn - 1])) simplex[nn] = refl;
        else { const [con] = yield* evaluate([pt(worst, pen(refl) < pen(worst) ? -0.5 : 0.5)], 'polish', 0, seedNo); evals++;
          if (pen(con) < Math.min(pen(refl), pen(worst))) simplex[nn] = con;
          else { const shr = simplex.slice(1).map(p => { const x = start.x.slice(); dims.forEach(d => { x[d] = clamp01(simplex[0].x[d] + 0.5 * (p.x[d] - simplex[0].x[d])); }); return x; });
            const rs = yield* evaluate(shr, 'polish', 0, seedNo); evals += shr.length; simplex = [simplex[0]].concat(rs); } }
        const size = Math.max(...dims.map(d => Math.max(...simplex.map(p => p.x[d])) - Math.min(...simplex.map(p => p.x[d]))));
        if (size < 1e-3) break;
      }
      simplex.sort((a, b) => pen(a) - pen(b));
      return simplex[0];
    }
  }

  /* ---------------- drivers ---------------- */
  function prepare(basis, opts) {
    const b0 = H2.completeBasis(Object.assign({}, basis));
    const o = Object.assign(H2.optimizeDefaults(), opts || {}); o.constraints = Object.assign(H2.optimizeDefaults().constraints, (opts && opts.constraints) || {});
    if (!H2.OBJECTIVES.some(x => x.id === o.objective)) throw new RangeError('unknown objective: ' + o.objective);
    const all = H2.optimizeVars(b0), chosen = (o.vars || all).filter(v => v.enabled !== false);
    const vars = chosen.map(v => { const d = all.find(a => a.key === v.key) || v; const w = Object.assign({}, d, v); if (!(w.max > w.min)) throw new RangeError(w.label + ': the upper bound must exceed the lower bound'); return w; });
    if (!vars.length) throw new RangeError('no variable is enabled');
    const state = { evals: 0, stop: null, t0: Date.now(), report: info => { if (o.onProgress) o.onProgress(Object.assign({ evals: state.evals, elapsed_ms: Date.now() - state.t0 }, info)); } };
    return { b0, o, vars, state };
  }
  function finish(p, out) {
    const { b0, o, vars, state } = p, best = out.best;
    const current = (() => { const r = out.log.find(r => r.phase === 'screen' && JSON.stringify(r.v) === JSON.stringify(decode(encode(b0, vars), vars, b0))); return r || null; })();
    return { objective: o.objective, unit: (H2.OBJECTIVES.find(x => x.id === o.objective) || {}).unit, vars, settings: Object.assign({}, o, { onProgress: undefined, pool: undefined, signal: undefined }),
      best, apply: best ? applyOf(best, b0) : null, current, runs: out.runs, evaluated: out.log, evaluations: state.evals, time_ms: Date.now() - state.t0, stop: state.stop || 'finished',
      measuredYears: o.objective === 'p90' && H2.siteYears && H2.siteYears(b0) >= 2 ? Math.min(H2.siteYears(b0), Math.max(2, o.p90Years | 0)) : 0,
      improvement: best && current && best.feasible && current.feasible ? (current.obj - best.obj) : null };
  }
  // the design-basis changes of a design: its sizes, and the design full-load hours of the sizing chain (DM 1.2) set to the
  // simulated capacity factor, as the wizard does, so that the sizing-chain capacity check agrees with the optimised plant
  function applyOf(rec, b0) {
    const ch = Object.assign({}, rec.v), s = rec.summary;
    if (s && s.kpi && isFinite(s.kpi.CF)) ch.FLH = Math.max(500, Math.min(8760, Math.round(s.kpi.CF * 8760 / (b0.availability || 0.95) / 100) * 100));
    return ch;
  }
  H2.optimizeApply = applyOf;
  const summaries = bases => H2.pool.local('summarySafe', bases);
  // serial: Node scripts, tests, the script console
  H2.optimizeSync = function (basis, opts) {
    const p = prepare(basis, opts), g = algorithm(p.b0, p.o, p.vars, p.state);
    let r = g.next();
    while (!r.done) { if (p.o.signal && p.o.signal.aborted) p.state.stop = 'cancelled'; r = g.next(summaries(r.value)); }
    return finish(p, r.value);
  };
  // asynchronous: on a worker pool when one is given (opts.pool), else serially with a yield to the event loop between batches
  H2.optimize = function (basis, opts) {
    return new Promise((resolve, reject) => {
      let p; try { p = prepare(basis, opts); } catch (e) { reject(e); return; }
      const g = algorithm(p.b0, p.o, p.vars, p.state), pool = p.o.pool;
      const step = res => {
        let r; try { r = g.next(res); } catch (e) { reject(e); return; }
        if (r.done) { resolve(finish(p, r.value)); return; }
        if (p.o.signal && p.o.signal.aborted) p.state.stop = 'cancelled';
        if (pool) pool.run('summarySafe', r.value).then(step, reject);
        else setTimeout(() => { let s; try { s = summaries(r.value); } catch (e) { reject(e); return; } step(s); }, 0);
      };
      step(undefined);
    });
  };
  H2.optimizeDecode = decode; H2.optimizeTarget = targetH2;

  /* rows for a results table or a CSV: the evaluated designs ranked by the feasibility rule */
  H2.optimizeRank = function (res, limit, distinct) {
    let rows = res.evaluated.slice().sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0));
    if (distinct) { const seen = new Set(); rows = rows.filter(r => { const k = JSON.stringify(Object.keys(r.v).map(q => +Number(r.v[q]).toPrecision(Number.isInteger(r.v[q]) ? 15 : 2))); if (seen.has(k)) return false; seen.add(k); return true; }); }
    return (limit ? rows.slice(0, limit) : rows).map((r, i) => Object.assign({ rank: i + 1 }, r));
  };
  if (H2.pool && H2.pool.define) H2.pool.define('summarySafe', b => { try { return H2.summary(H2.solveSystem(b)); } catch (e) { return { error: String(e && e.message || e) }; } });
})(typeof window !== 'undefined' ? window : globalThis);

;
/* Hasim – Green Hydrogen Engineering Suite. © 2026 Prof. Hani Muhsen. All rights reserved. */
/* =====================================================================
   Hasim – engine-risk.js (Hasim 3.0): Monte Carlo risk curves
   Uncertain inputs of the design basis as distributions – uniform, triangular, normal or lognormal, as
   multipliers of the basis value or as values –, the weather as measured years drawn with equal probability or
   as synthetic years from new seeds with resource factors, Latin-hypercube sampling (McKay, Beckman and Conover
   1979) from a seeded generator, every sample solved with the complete model (worker pool or in the page),
   percentiles by the Hyndman–Fan type-7 sample quantile, the probability of a cost target with its standard
   error (Muhsen 2026, Eq. 13.33), the normal-approximation P90 of Eq. 13.34 for comparison, and the drivers of
   the spread by conditional deciles and standardised regression coefficients.
   Nothing here is taken from any other simulation software.
   Owner and developer: Prof. Hani Muhsen.
   ===================================================================== */
(function (root) {
  'use strict';
  const H2 = root.H2;
  const workerBases = new Map();            // runId → basis, kept in a worker so the site arrays travel once

  /* ---------- distributions: probability p (0…1) → value ---------- */
  H2.RISK_DISTS = {
    uniform: { label: 'Uniform', params: ['lo', 'hi'], names: ['low', 'high'] },
    triangular: { label: 'Triangular', params: ['lo', 'mode', 'hi'], names: ['low', 'mode', 'high'] },
    normal: { label: 'Normal', params: ['mean', 'sd'], names: ['mean', 'std. dev.'] },
    lognormal: { label: 'Lognormal', params: ['median', 'sigma'], names: ['median', 'σ (ln)'] }
  };
  // inverse of the standard normal distribution (Acklam 2003, relative error below 1.2e-9)
  const normInv = p => {
    const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239],
      b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1],
      c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783],
      d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
    p = Math.min(1 - 1e-12, Math.max(1e-12, p));
    if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  };
  H2.normInv = normInv;
  /* the value at probability p of a distribution q = { dist, lo, hi, mode, mean, sd, median, sigma }; normal and
     lognormal draws are limited to the central 99.8 % (3.09 σ), so a tail value cannot leave the physical range */
  H2.riskInverse = function (q, p) {
    p = Math.min(1, Math.max(0, p));
    switch (q.dist) {
      case 'triangular': { const lo = +q.lo, hi = +q.hi, m = Math.min(hi, Math.max(lo, +q.mode)); if (!(hi > lo)) return lo; const F = (m - lo) / (hi - lo);
        return p < F ? lo + Math.sqrt(p * (hi - lo) * (m - lo)) : hi - Math.sqrt((1 - p) * (hi - lo) * (hi - m)); }
      case 'normal': return +q.mean + +q.sd * normInv(Math.min(0.999, Math.max(0.001, p)));
      case 'lognormal': return +q.median * Math.exp(+q.sigma * normInv(Math.min(0.999, Math.max(0.001, p))));
      default: { const lo = +q.lo, hi = +q.hi; return lo + (hi - lo) * p; }
    }
  };
  H2.riskMean = q => (q.dist === 'triangular' ? (+q.lo + +q.mode + +q.hi) / 3 : q.dist === 'normal' ? +q.mean : q.dist === 'lognormal' ? +q.median * Math.exp(+q.sigma * +q.sigma / 2) : (+q.lo + +q.hi) / 2);
  // default parameters of a distribution around a factor of 1 (or a value v) with a relative half-width w
  H2.riskDefaultParams = function (dist, centre, w, sdRel) {
    const c = centre == null ? 1 : centre, sd = c * (sdRel == null ? w / 2 : sdRel);
    if (dist === 'triangular') return { dist, lo: c * (1 - w), mode: c, hi: c * (1 + w) };
    if (dist === 'normal') return { dist, mean: c, sd };
    if (dist === 'lognormal') return { dist, median: c, sigma: sdRel == null ? w / 2 : sdRel };
    return { dist, lo: c * (1 - w), hi: c * (1 + w) };
  };

  /* ---------- the uncertain inputs of a design basis ----------
     kind 'factor': the basis value is multiplied by the draw (1 = the basis); kind 'value': the draw is the value.
     also: further basis keys scaled with the same factor; series: a site series scaled with it. */
  const r4 = v => Math.round(v * 1e4) / 1e4;
  const INPUTS = [
    { key: 'pel', label: 'Electricity price (PPA, grid imports, hourly series)', group: 'Market', kind: 'factor', w: 0.2, dist: 'triangular', on: b => b.supply !== 'islanded', also: ['exportPrice'], series: 'price', def: true },
    { key: 'capexEly', label: 'Electrolyser system CAPEX', group: 'Capital', kind: 'factor', w: 0.2, dist: 'triangular', on: () => true, def: true },
    { key: 'pvCapex', label: 'PV CAPEX', group: 'Capital', kind: 'factor', w: 0.2, dist: 'triangular', on: b => b.supply === 'islanded' && b.pvMWp > 0, def: true },
    { key: 'windCapex', label: 'Wind CAPEX', group: 'Capital', kind: 'factor', w: 0.2, dist: 'triangular', on: b => b.supply === 'islanded' && b.windMW > 0, def: true },
    { key: 'batCapex', label: 'Battery CAPEX', group: 'Capital', kind: 'factor', w: 0.2, dist: 'triangular', on: b => b.batMWh > 0, def: true },
    { key: 'storeCapex', label: 'Hydrogen storage CAPEX', group: 'Capital', kind: 'factor', w: 0.2, dist: 'triangular', on: () => true, def: false },
    { key: 'otherCapexFrac', label: 'Other direct costs (× electrolyser)', group: 'Capital', kind: 'factor', w: 0.2, dist: 'triangular', on: () => true, def: false },
    { key: 'stackFrac', label: 'Stack share of CAPEX (replacements)', group: 'Capital', kind: 'factor', w: 0.15, dist: 'triangular', on: () => true, def: false },
    { key: 'fixedOpexFrac', label: 'Fixed OPEX (share of CAPEX)', group: 'Operation', kind: 'factor', w: 0.2, dist: 'triangular', on: () => true, def: false },
    { key: 'waterPrice', label: 'Raw-water price', group: 'Operation', kind: 'factor', w: 0.3, dist: 'triangular', on: b => b.waterPrice > 0, def: false },
    { key: 'availability', label: 'Plant availability', group: 'Operation', kind: 'value', dist: 'triangular', on: () => true, def: false, params: b => ({ dist: 'triangular', lo: r4(Math.max(0.5, b.availability - 0.03)), mode: b.availability, hi: r4(Math.min(1, b.availability + 0.01)) }) },
    { key: 'WACC', label: 'WACC', group: 'Finance', kind: 'value', dist: 'normal', on: () => true, def: true, params: b => ({ dist: 'normal', mean: b.WACC, sd: 0.01 }) },
    { key: 'GHI', label: 'Solar resource – annual GHI (interannual and measurement)', group: 'Resource', kind: 'factor', w: 0.06, dist: 'normal', sdRel: 0.03, on: b => b.pvMWp > 0, def: true },
    { key: 'vmean', label: 'Wind resource – mean wind speed (interannual and measurement)', group: 'Resource', kind: 'factor', w: 0.12, dist: 'normal', sdRel: 0.06, on: b => b.windMW > 0, def: true },
    { key: 'gridCI', label: 'Grid carbon intensity (carbon intensity only)', group: 'Market', kind: 'factor', w: 0.2, dist: 'uniform', on: b => b.gridMW > 0, def: false },
    { key: 'premium', label: 'Production premium (policy pack)', group: 'Policy', kind: 'factor', w: 0.3, dist: 'uniform', on: b => b.premium > 0, def: false },
    { key: 'co2Price', label: 'Carbon price (policy pack)', group: 'Policy', kind: 'factor', w: 0.4, dist: 'triangular', on: b => b.co2Price > 0, def: false },
    { key: 'h2Price', label: 'Hydrogen value (NPV only)', group: 'Policy', kind: 'factor', w: 0.2, dist: 'triangular', on: b => b.h2Price > 0, def: false }
  ];
  H2.RISK_LIMITS = { pel: [0, 1000], capexEly: [100, 10000], pvCapex: [0, 5000], windCapex: [0, 6000], batCapex: [0, 3000], storeCapex: [0, 5000], otherCapexFrac: [0, 5], stackFrac: [0, 0.8], fixedOpexFrac: [0, 0.2], waterPrice: [0, 20],
    availability: [0.5, 1], WACC: [0, 0.3], GHI: [500, 2800], vmean: [2, 14], gridCI: [0, 1200], exportPrice: [-100, 500], premium: [-20, 20], co2Price: [0, 1000], h2Price: [0, 50] };
  /* the inputs that apply to a basis, each with its default distribution; opt.settings = { key: { enabled, dist, lo, … } } overrides */
  H2.riskInputs = function (basis, settings) {
    const b = H2.completeBasis(basis || {}); settings = settings || {};
    return INPUTS.filter(d => d.on(b) && typeof b[d.key] === 'number').map(d => {
      const base = d.params ? d.params(b) : H2.riskDefaultParams(d.dist, 1, d.w, d.sdRel);
      const s = settings[d.key] || {};
      const dist = s.dist && H2.RISK_DISTS[s.dist] ? s.dist : base.dist;
      let q = dist === base.dist ? Object.assign({}, base) : (d.kind === 'value' ? H2.riskDefaultParams(dist, b[d.key], 0.1) : H2.riskDefaultParams(dist, 1, d.w, d.sdRel));
      H2.RISK_DISTS[dist].params.forEach(p => { if (s[p] != null && isFinite(+s[p])) q[p] = +s[p]; });
      q.dist = dist;
      return { key: d.key, label: d.label, group: d.group, kind: d.kind, enabled: s.enabled == null ? d.def : !!s.enabled, value: b[d.key], unit: d.kind === 'factor' ? '×' : (d.key === 'WACC' || d.key === 'availability' ? '–' : ''), q, also: d.also || [], series: d.series || null, mean: H2.riskMean(q) };
    });
  };
  H2.riskDefaults = () => ({ samples: 500, seed: 1, weather: 'auto', h2Value: 0, bins: 20, batch: 8 });

  /* ---------- Latin-hypercube samples ---------- */
  // weather modes: measured (years drawn equally), synthetic (new seeds), fixed (the year of the basis), auto = measured when ≥ 2 years, else synthetic
  H2.riskWeatherMode = function (basis, mode) {
    const years = H2.siteYears ? H2.siteYears(basis) : 0;
    if (mode === 'measured' && years >= 1) return 'measured';
    if (mode === 'synthetic' || mode === 'fixed') return mode;
    return years >= 2 ? 'measured' : 'synthetic';
  };
  H2.riskSamples = function (basis, opt) {
    if (!basis || typeof basis !== 'object') throw new TypeError('a design basis is required');
    opt = Object.assign(H2.riskDefaults(), opt || {});
    const n = Math.round(+opt.samples), seed = Math.round(+opt.seed);
    if (!(n >= 1 && n <= 20000) || n !== +opt.samples) throw new RangeError('sample count must be an integer from 1 to 20000');
    if (!(seed >= 0 && seed <= 0x7fffffff) || seed !== +opt.seed) throw new RangeError('random seed must be an integer from 0 to 2147483647');
    const inputs = (opt.inputs || H2.riskInputs(basis, opt.settings)).filter(x => x.enabled !== false);
    const R = H2.rng(seed * 2654435761 + 97), years = H2.siteYears ? H2.siteYears(basis) : 0, mode = H2.riskWeatherMode(basis, opt.weather);
    // one stratified column per dimension: a random permutation of the n intervals, a random position inside each
    const column = () => { const perm = new Array(n); for (let i = 0; i < n; i++) perm[i] = i; for (let i = n - 1; i > 0; i--) { const j = Math.floor(R.u() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; } const u = new Float64Array(n); for (let i = 0; i < n; i++) u[i] = (perm[i] + R.u()) / n; return u; };
    const cols = inputs.map(() => column()), wcol = column(), scol = column();
    const samples = new Array(n);
    for (let i = 0; i < n; i++) {
      const v = {}; inputs.forEach((inp, d) => { v[inp.key] = H2.riskInverse(inp.q, cols[d][i]); });
      samples[i] = { index: i + 1, v, weatherMode: mode, weatherIndex: mode === 'measured' ? Math.min(years - 1, Math.floor(wcol[i] * years)) : null, weatherSeed: mode === 'synthetic' ? 1 + Math.floor(scol[i] * 9999) : null };
    }
    return { inputs, samples, mode, years, seed, n };
  };

  /* ---------- the basis of one sample ---------- */
  const clampTo = (k, v) => { const L = H2.RISK_LIMITS[k]; return L ? Math.min(L[1], Math.max(L[0], v)) : v; };
  H2.riskBasis = function (basis, sample, inputs) {
    if (!basis || typeof basis !== 'object' || !sample || typeof sample !== 'object') throw new TypeError('a design basis and a sample are required');
    inputs = inputs || H2.riskInputs(basis);
    const out = Object.assign({}, basis); let site = basis.site ? Object.assign({}, basis.site) : null;
    const v = sample.v || {};
    inputs.forEach(inp => {
      const x = v[inp.key]; if (x == null || !isFinite(x)) return;
      if (inp.kind === 'factor') {
        const f = Math.max(0, x);
        [inp.key].concat(inp.also || []).forEach(k => { if (typeof basis[k] === 'number') out[k] = clampTo(k, basis[k] * f); });
        if (inp.series && site && site[inp.series] && Array.isArray(site[inp.series].series)) site[inp.series] = Object.assign({}, site[inp.series], { series: site[inp.series].series.map(y => y * f), id: undefined });
        if ((inp.key === 'GHI' || inp.key === 'vmean') && site && site.weather) site.__scale = Object.assign({}, site.__scale || {}, { [inp.key]: f });
      } else out[inp.key] = clampTo(inp.key, x);
    });
    // weather: a measured year, a fresh synthetic seed, or the basis year as it is
    const mode = sample.weatherMode || (sample.weatherIndex != null ? 'measured' : sample.weatherSeed != null ? 'synthetic' : 'fixed');
    if (mode === 'synthetic') { if (site) delete site.weather; if (sample.weatherSeed != null) { const s = Math.round(+sample.weatherSeed); if (!(s >= 1 && s <= 9999)) throw new RangeError('synthetic weather seed must be an integer from 1 to 9999'); out.seed = s; } }
    else if (mode === 'measured') {
      const years = H2.siteYears ? H2.siteYears(basis) : 0, i = sample.weatherIndex == null ? (site && site.weather ? site.weather.use | 0 : 0) : +sample.weatherIndex;
      if (!(years >= 1)) throw new RangeError('a measured weather year was requested, but the basis has no measured weather');
      if (!(Number.isInteger(i) && i >= 0 && i < years)) throw new RangeError('weather-year sample is outside the imported years');
      site.weather = H2.siteUse(site, i).weather;
    }
    // resource factors on a measured year scale its hourly series (a new identity for the weather cache)
    if (site && site.__scale && site.weather) {
      const sc = site.__scale, w = site.weather, y = w.years[Math.min(w.years.length - 1, Math.max(0, w.use | 0))];
      const yy = Object.assign({}, y); if (sc.GHI != null) { yy.ghi = y.ghi.map(g => g * sc.GHI); if (y.dni) yy.dni = y.dni.map(g => g * sc.GHI); if (y.dhi) yy.dhi = y.dhi.map(g => g * sc.GHI); } if (sc.vmean != null) yy.ws = y.ws.map(s => s * sc.vmean);
      const years = w.years.slice(); years[Math.min(w.years.length - 1, Math.max(0, w.use | 0))] = yy;
      site.weather = Object.assign({}, w, { years, id: undefined });
    }
    if (site) { delete site.__scale; out.site = Object.keys(site).length ? site : undefined; }
    return out;
  };

  /* ---------- one batch of samples: the pool function 'risk' ---------- */
  H2.riskInit = function (input) {
    if (!input || typeof input.runId !== 'string' || !input.basis || typeof input.basis !== 'object') throw new TypeError('a run id and a design basis are required');
    workerBases.set(input.runId, { basis: input.basis, inputs: input.inputs || null }); return input.runId;
  };
  H2.riskForget = input => { const id = input && typeof input === 'object' ? input.runId : input; workerBases.delete(id); return id; };
  H2.riskBatch = function (input) {
    if (!input || !Array.isArray(input.samples)) throw new TypeError('a sample batch is required');
    const kept = input.runId ? workerBases.get(input.runId) : null, basis = input.basis || (kept && kept.basis), inputs = input.inputs || (kept && kept.inputs) || H2.riskInputs(basis);
    if (!basis) throw new Error('the Monte Carlo worker has not received the design basis of this run');
    return input.samples.map(sample => {
      const b = H2.riskBasis(basis, sample, inputs), sys = H2.solveSystem(b), k = sys.kpi;
      if (!k || !isFinite(k.LCOH)) throw new Error('sample ' + sample.index + ' returned no finite LCOH');
      const weather = sample.weatherMode === 'synthetic' || (sample.weatherIndex == null && sample.weatherSeed != null) ? 'synthetic seed ' + b.seed : sample.weatherIndex != null && basis.site && basis.site.weather ? basis.site.weather.years[sample.weatherIndex].label : 'basis year';
      return { index: sample.index, weather, weatherIndex: sample.weatherIndex == null ? null : sample.weatherIndex, weatherSeed: sample.weatherIndex == null ? b.seed : null, v: sample.v,
        LCOH: k.LCOH, LCOHp: k.LCOH_policy != null ? k.LCOH_policy : k.LCOH, NPV: k.NPV_policy != null ? k.NPV_policy : null, H2_t: k.H2_t, CI: k.CI, CAPEX: k.CAPEX, CF: k.CF, SEC: k.SEC, pass: sys.checks.filter(c => c.ok).length, checks: sys.checks.length };
    });
  };
  if (H2.pool) { H2.pool.define('riskInit', H2.riskInit); H2.pool.define('riskForget', H2.riskForget); H2.pool.define('risk', H2.riskBatch); }

  /* ---------- statistics ---------- */
  // Hyndman–Fan type-7 sample quantile: h = (n − 1) p, linear interpolation between order statistics
  H2.riskQuantile = function (values, p) {
    if (!(typeof p === 'number' && isFinite(p) && p >= 0 && p <= 1)) throw new RangeError('quantile probability must be from 0 to 1');
    const x = Array.from(values).filter(v => typeof v === 'number' && isFinite(v)).sort((a, b) => a - b);
    if (!x.length) throw new RangeError('at least one finite sample is required');
    const h = (x.length - 1) * p, i = Math.floor(h);
    return x[i] + (x[Math.min(x.length - 1, i + 1)] - x[i]) * (h - i);
  };
  const stats = values => {
    const x = Array.from(values).filter(v => isFinite(v)).sort((a, b) => a - b), n = x.length; if (!n) return null;
    let m = 0; for (const v of x) m += v; m /= n; let s2 = 0; for (const v of x) s2 += (v - m) * (v - m);
    const sd = n > 1 ? Math.sqrt(s2 / (n - 1)) : 0;
    return { n, mean: m, sd, min: x[0], max: x[n - 1], p10: H2.riskQuantile(x, 0.1), p50: H2.riskQuantile(x, 0.5), p90: H2.riskQuantile(x, 0.9), p90_normal: m + 1.2816 * sd, p10_normal: m - 1.2816 * sd };
  };
  // standardised regression coefficients of y on the columns X (least squares by normal equations), with R²
  function regression(X, y) {
    const n = y.length, k = X.length; if (!n || !k) return null;
    const mean = a => a.reduce((s, v) => s + v, 0) / n, sd = (a, m) => Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / Math.max(1, n - 1));
    const my = mean(y), sy = sd(y, my); if (!(sy > 0)) return null;
    const mx = X.map(mean), sx = X.map((c, j) => sd(c, mx[j]));
    const Z = X.map((c, j) => (sx[j] > 0 ? c.map(v => (v - mx[j]) / sx[j]) : c.map(() => 0))), yz = y.map(v => (v - my) / sy);
    const A = []; for (let i = 0; i < k; i++) { A.push(new Array(k + 1).fill(0)); for (let j = 0; j < k; j++) { let s = 0; for (let t = 0; t < n; t++) s += Z[i][t] * Z[j][t]; A[i][j] = s; } let s = 0; for (let t = 0; t < n; t++) s += Z[i][t] * yz[t]; A[i][k] = s; }
    for (let i = 0; i < k; i++) A[i][i] += 1e-9 * n;         // ridge against a constant column
    for (let c = 0; c < k; c++) { let p = c; for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; if (p !== c) { const t = A[p]; A[p] = A[c]; A[c] = t; } const d = A[c][c]; if (Math.abs(d) < 1e-12) continue;
      for (let r = 0; r < k; r++) { if (r === c) continue; const f = A[r][c] / d; for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j]; } }
    const beta = A.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[k] / row[i]));
    let ssr = 0; for (let t = 0; t < n; t++) { let f = 0; for (let j = 0; j < k; j++) f += beta[j] * Z[j][t]; ssr += (yz[t] - f) * (yz[t] - f); }
    return { beta, R2: Math.max(0, 1 - ssr / Math.max(1e-12, yz.reduce((s, v) => s + v * v, 0))) };
  }
  /* the summary of a run: percentiles of LCOH, production, carbon intensity and CAPEX; the probability of a cost at or
     below a hydrogen value with its standard error (Eq. 13.33); the drivers of the spread; histogram and risk curve */
  H2.riskSummary = function (records, inputs, opt) {
    opt = opt || {}; inputs = inputs || [];
    const R = records.filter(r => r && isFinite(r.LCOH)); if (!R.length) throw new RangeError('no finished samples');
    const L = R.map(r => r.LCOH), out = { n: R.length, lcoh: stats(L), h2: stats(R.map(r => r.H2_t)), ci: stats(R.map(r => r.CI)), capex: stats(R.map(r => r.CAPEX)), cf: stats(R.map(r => r.CF)) };
    if (R.some(r => r.LCOHp != null && r.LCOHp !== r.LCOH)) out.lcohp = stats(R.map(r => (r.LCOHp != null ? r.LCOHp : r.LCOH)));
    if (R.every(r => typeof r.NPV === 'number' && isFinite(r.NPV))) out.npv = stats(R.map(r => r.NPV));
    if (opt.h2Value > 0) { const p = L.filter(v => v <= opt.h2Value).length / L.length; out.prob = { value: opt.h2Value, p, se: Math.sqrt(p * (1 - p) / L.length) }; }
    // drivers: LCOH in the lowest and highest decile of each input, the correlation, and the standardised regression coefficient
    const act = inputs.filter(inp => inp.enabled !== false && R.every(r => r.v && isFinite(r.v[inp.key]))), dec = Math.max(1, Math.floor(R.length / 10));
    const cols = act.map(inp => R.map(r => r.v[inp.key])), reg = act.length && R.length > act.length + 2 ? regression(cols, L) : null;
    const mL = out.lcoh.mean, sL = out.lcoh.sd;
    out.drivers = act.map((inp, j) => {
      const ord = R.map((r, i) => i).sort((a, b) => cols[j][a] - cols[j][b]);
      const low = ord.slice(0, dec).reduce((s, i) => s + L[i], 0) / dec, high = ord.slice(-dec).reduce((s, i) => s + L[i], 0) / dec;
      const mx = cols[j].reduce((s, v) => s + v, 0) / R.length; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < R.length; i++) { sxy += (cols[j][i] - mx) * (L[i] - mL); sxx += (cols[j][i] - mx) * (cols[j][i] - mx); syy += (L[i] - mL) * (L[i] - mL); }
      const corr = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0, src = reg ? reg.beta[j] : corr;
      return { key: inp.key, label: inp.label, low, high, swing: high - low, corr, src, share: src * src, lowValue: cols[j][ord[Math.floor(dec / 2)]], highValue: cols[j][ord[ord.length - 1 - Math.floor(dec / 2)]] };
    });
    const shareSum = out.drivers.reduce((s, d) => s + d.share, 0); if (shareSum > 0) out.drivers.forEach(d => { d.share = d.share / Math.max(1, shareSum); });
    out.drivers.sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing)); out.R2 = reg ? reg.R2 : null;
    // the weather as a driver: measured years by their mean, synthetic years by the spread of the seeds at the median inputs
    const yrs = {}; R.forEach(r => { if (r.weatherIndex != null) { const k = r.weather; (yrs[k] = yrs[k] || []).push(r.LCOH); } });
    out.years = Object.keys(yrs).map(k => ({ label: k, n: yrs[k].length, mean: yrs[k].reduce((s, v) => s + v, 0) / yrs[k].length })).sort((a, b) => a.mean - b.mean);
    if (out.years.length >= 2) out.drivers.push({ key: 'weather', label: 'Weather year (measured)', low: out.years[0].mean, high: out.years[out.years.length - 1].mean, swing: out.years[out.years.length - 1].mean - out.years[0].mean, corr: null, src: null, share: null });
    if (reg && sL > 0) { const unexplained = 1 - reg.R2; out.residualShare = unexplained; }
    // histogram and cumulative curve
    const bins = Math.max(5, Math.min(60, opt.bins | 0 || 20)), lo = out.lcoh.min, hi = out.lcoh.max, w = hi > lo ? (hi - lo) / bins : 1;
    const counts = new Array(bins).fill(0); L.forEach(v => { counts[Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / w)))]++; });
    out.hist = { edges: Array.from({ length: bins + 1 }, (_, i) => lo + i * w), counts, centres: Array.from({ length: bins }, (_, i) => lo + (i + 0.5) * w) };
    out.sorted = L.slice().sort((a, b) => a - b);
    return out;
  };

  /* ---------- runs ---------- */
  // serial, in this thread (scripts and tests)
  H2.riskSync = function (basis, opt) {
    opt = Object.assign(H2.riskDefaults(), opt || {}); const t0 = Date.now();
    const b = H2.normalizeBasis(basis).b, S = H2.riskSamples(b, opt), records = H2.riskBatch({ basis: b, inputs: S.inputs, samples: S.samples });
    return { records, inputs: S.inputs, settings: { samples: S.n, seed: S.seed, weather: S.mode, h2Value: opt.h2Value || 0 }, mode: S.mode, years: S.years, summary: H2.riskSummary(records, S.inputs, opt), time_ms: Date.now() - t0, basisName: b.name };
  };
  /* asynchronous: on a worker pool (opt.pool) in batches, or in this thread with yields; opt.onProgress(done, total), opt.signal cancels */
  H2.risk = async function (basis, opt) {
    opt = Object.assign(H2.riskDefaults(), opt || {}); const t0 = Date.now();
    const b = H2.normalizeBasis(basis).b, S = H2.riskSamples(b, opt), pool = opt.pool || null, runId = 'risk-' + t0 + '-' + Math.floor(Math.random() * 1e6);
    const records = [], batch = Math.max(1, opt.batch | 0 || 8), signal = opt.signal;
    if (pool) await pool.run('riskInit', Array.from({ length: pool.size }, () => ({ runId, basis: b, inputs: S.inputs })), { chunk: 1 });
    try {
      let cursor = 0;
      while (cursor < S.samples.length && !(signal && signal.aborted)) {
        const jobs = []; const per = pool ? pool.size : 1;
        for (let w = 0; w < per && cursor < S.samples.length; w++) { jobs.push(pool ? { runId, samples: S.samples.slice(cursor, cursor + batch) } : { basis: b, inputs: S.inputs, samples: S.samples.slice(cursor, cursor + batch) }); cursor += batch; }
        if (pool) (await pool.run('risk', jobs, { chunk: 1 })).forEach(rs => records.push(...rs));
        else { records.push(...H2.riskBatch(jobs[0])); await new Promise(r => setTimeout(r, 0)); }
        if (opt.onProgress) opt.onProgress(records.length, S.samples.length);
      }
    } finally { if (pool) { try { await pool.run('riskForget', Array.from({ length: pool.size }, () => ({ runId })), { chunk: 1 }); } catch (e) { /* workers gone */ } } }
    const cancelled = !!(signal && signal.aborted && records.length < S.samples.length);
    return { records, inputs: S.inputs, settings: { samples: S.n, seed: S.seed, weather: S.mode, h2Value: opt.h2Value || 0 }, mode: S.mode, years: S.years, summary: records.length ? H2.riskSummary(records, S.inputs, opt) : null, cancelled, time_ms: Date.now() - t0, basisName: b.name, workers: pool ? pool.size : 0 };
  };

  if (typeof module !== 'undefined') module.exports = H2;
})(typeof window !== 'undefined' ? window : globalThis);

;
/* Hasim – Green Hydrogen Engineering Suite. © 2026 Prof. Hani Muhsen. All rights reserved. */
/* =====================================================================
   Hasim – figures-core.js
   Engineering drawing kernel: drawing sheets with title blocks, ISO 10628 /
   IEC 60617 style symbols, process lines, stream tags, instrument bubbles,
   Sankey layout and an interactive zoom/pan drawing viewer.
   Owner and developer: Prof. Hani Muhsen.
   ===================================================================== */
(function (root) {
  'use strict';
  const F = root.H2F = root.H2F || {};
  const OWNER = 'Prof. Hani Muhsen';
  F.OWNER = OWNER;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  F.esc = esc;
  /* number formatting for drawings: thin-space thousands, adaptive decimals */
  function fv(v, d) {
    if (typeof v !== 'number') return v == null ? '–' : String(v);
    if (!isFinite(v)) return '–';
    const a = Math.abs(v); let s;
    if (d != null) s = v.toFixed(d);
    else if (a >= 100) s = v.toFixed(0); else if (a >= 10) s = v.toFixed(1); else if (a >= 1) s = v.toFixed(2); else if (a === 0) s = '0'; else if (a >= 0.01) s = v.toFixed(3); else s = v.toExponential(1);
    const parts = s.split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return parts.join('.');
  }
  F.fv = fv;
  F.fvs = function (v, d) { const s = fv(v, d); return typeof v === 'number' && s.indexOf('.') > 0 && s.indexOf('e') < 0 ? s.replace(/\.?0+$/, '') : s; };
  const ST = { h2: '--st-h2', o2: '--st-o2', water: '--st-water', lye: '--st-lye', cool: '--st-cool', elec: '--st-elec', dc: '--st-dc', n2: '--st-n2', nh3: '--st-nh3', air: '--st-air', heat: '--st-heat', loss: '--st-loss', aux: '--st-aux', ink: '--dw-ink' };
  F.ST = ST;
  const col = t => 'var(' + (ST[t] || '--dw-ink') + ')';
  F.col = col;
  F.STREAM_NAMES = { h2: 'Hydrogen', o2: 'Oxygen', water: 'Water / steam', lye: 'Electrolyte / loop water', cool: 'Coolant', elec: 'AC power', dc: 'DC power', n2: 'Nitrogen', nh3: 'Ammonia', air: 'Air', heat: 'Heat', loss: 'Losses', aux: 'Auxiliaries' };

  /* ---------- text ---------- */
  function T(x, y, s, o) {
    o = o || {};
    return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '"' + (o.a ? ' text-anchor="' + o.a + '"' : '') + ' font-size="' + (o.s || 12) + '"' + (o.w ? ' font-weight="' + o.w + '"' : '') +
      ' fill="' + (o.c || 'var(--dw-ink)') + '"' + (o.halo ? ' stroke="var(--dw-sheet)" stroke-width="3.2" paint-order="stroke" stroke-linejoin="round"' : '') + (o.it ? ' font-style="italic"' : '') + (o.rot ? ' transform="rotate(' + o.rot + ' ' + x + ' ' + y + ')"' : '') + (o.cls ? ' class="' + o.cls + '"' : '') + '>' + esc(s) + '</text>';
  }
  F.T = T;
  const L = (x1, y1, x2, y2, o) => { o = o || {}; return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (o.c || 'var(--dw-ink)') + '" stroke-width="' + (o.w || 1.4) + '"' + (o.d ? ' stroke-dasharray="' + o.d + '"' : '') + '/>'; };
  const Rct = (x, y, w, h, o) => { o = o || {}; return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"' + (o.rx ? ' rx="' + o.rx + '"' : '') + ' fill="' + (o.f || 'var(--dw-fill)') + '" stroke="' + (o.c || 'var(--dw-ink)') + '" stroke-width="' + (o.w == null ? 1.5 : o.w) + '"' + (o.d ? ' stroke-dasharray="' + o.d + '"' : '') + '/>'; };
  const Cir = (x, y, r, o) => { o = o || {}; return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + (o.f || 'var(--dw-fill)') + '" stroke="' + (o.c || 'var(--dw-ink)') + '" stroke-width="' + (o.w == null ? 1.5 : o.w) + '"' + (o.d ? ' stroke-dasharray="' + o.d + '"' : '') + '/>'; };
  const P = (d, o) => { o = o || {}; return '<path d="' + d + '" fill="' + (o.f || 'none') + '" stroke="' + (o.c || 'var(--dw-ink)') + '" stroke-width="' + (o.w == null ? 1.5 : o.w) + '"' + (o.d ? ' stroke-dasharray="' + o.d + '"' : '') + (o.op ? ' opacity="' + o.op + '"' : '') + ' stroke-linejoin="round" stroke-linecap="round"/>'; };
  Object.assign(F, { L, Rct, Cir, P });

  /* ---------- defs: arrowheads, hatches ---------- */
  F.defs = function () {
    let s = '<defs>';
    Object.keys(ST).forEach(k => { s += '<marker id="ah-' + k + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="' + col(k) + '"/></marker>'; });
    s += '<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--dw-thin)" stroke-width="1"/></pattern>';
    s += '<pattern id="xhatch" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0,0 L7,7 M7,0 L0,7" stroke="var(--dw-thin)" stroke-width="0.8"/></pattern>';
    s += '<pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="0.9" fill="var(--dw-thin)"/></pattern>';
    s += '<pattern id="pvcells" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="var(--st-water)" opacity="0.18"/><path d="M8,0 V8 M0,8 H8" stroke="var(--dw-thin)" stroke-width="0.6"/></pattern>';
    s += '<pattern id="grass" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M2,8 l1,-3 M6,9 l1,-3" stroke="var(--dw-thin)" stroke-width="0.6"/></pattern>';
    return s + '</defs>';
  };

  /* ---------- process lines ---------- */
  // pts: [[x,y],...]; type: stream colour key; o: {w, dash, arrow, id, title}
  F.line = function (pts, type, o) {
    o = o || {};
    const d = 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L');
    const w = o.w || (type === 'dc' ? 3.2 : type === 'elec' ? 2 : type === 'cool' ? 1.8 : 2.2);
    const dash = o.dash || (type === 'elec' ? '' : type === 'cool' ? '7 4' : '');
    let s = '<g class="pline"' + (o.id ? ' data-stream="' + esc(o.id) + '"' : '') + '>';
    s += '<path d="' + d + '" fill="none" stroke="var(--dw-sheet)" stroke-width="' + (w + 5) + '" stroke-linejoin="round"/>';
    s += '<path d="' + d + '" fill="none" stroke="' + col(type) + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' stroke-linejoin="round"' + (o.arrow === false ? '' : ' marker-end="url(#ah-' + type + ')"') + '/>';
    if (o.id) s += '<path d="' + d + '" fill="none" stroke="transparent" stroke-width="12" class="hit"/>';
    return s + '</g>';
  };
  // stream number diamond (ISO 10628)
  F.tag = function (x, y, num, type, id) {
    const r = 11;
    return '<g class="stag"' + (id ? ' data-stream="' + esc(id) + '"' : '') + '><path d="M' + x + ',' + (y - r) + ' L' + (x + r) + ',' + y + ' L' + x + ',' + (y + r) + ' L' + (x - r) + ',' + y + ' Z" fill="var(--dw-sheet)" stroke="' + col(type) + '" stroke-width="1.6"/>' + T(x, y + 4, num, { a: 'middle', s: 10.5, w: 700, c: col(type) }) + '</g>';
  };
  // instrument bubble (ISA 5.1)
  F.instr = function (x, y, letters, num, lx, ly) {
    let s = '';
    if (lx != null) s += L(lx, ly, x, y + 13, { c: 'var(--dw-ink2)', w: 1, d: '3 2' });
    return s + '<g class="instr">' + Cir(x, y, 13, { f: 'var(--dw-sheet)', w: 1.2 }) + L(x - 13, y, x + 13, y, { w: 0.9 }) + T(x, y - 2.5, letters, { a: 'middle', s: 9, w: 700 }) + T(x, y + 10, num, { a: 'middle', s: 8.5 }) + '</g>';
  };
  // off-page connector
  F.offpage = function (x, y, text, dir, type) {
    const w = 64, h = 18; const pts = dir === 'left' ? [[x, y - h / 2], [x + w, y - h / 2], [x + w, y + h / 2], [x, y + h / 2], [x - 9, y]] : [[x, y - h / 2], [x + w, y - h / 2], [x + w + 9, y], [x + w, y + h / 2], [x, y + h / 2]];
    return '<g>' + '<polygon points="' + pts.map(p => p.join(',')).join(' ') + '" fill="var(--dw-sheet)" stroke="' + col(type || 'ink') + '" stroke-width="1.3"/>' + T(x + w / 2, y + 4, text, { a: 'middle', s: 9.5, w: 600 }) + '</g>';
  };
  // equipment label
  F.label = function (x, y, tag, name, o) {
    o = o || {};
    return T(x, y, tag, { a: o.a || 'middle', s: o.s || 13, w: 700 }) + (name ? T(x, y + 14, name, { a: o.a || 'middle', s: o.ns || 10.5, c: 'var(--dw-ink2)' }) : '') + (o.extra ? T(x, y + 27, o.extra, { a: o.a || 'middle', s: o.ns || 10.5, c: 'var(--dw-ink2)' }) : '');
  };
  // interactive wrapper
  F.eqg = (tag, inner) => '<g class="eq" data-tag="' + esc(tag) + '">' + inner + '</g>';

  /* ---------- symbols ---------- */
  const S = F.sym = {};
  S.electrolyser = function (x, y, w, h) {
    let s = Rct(x, y, w, h, { rx: 3, w: 1.8 });
    s += Rct(x + 4, y + 4, 12, h - 8, { f: 'var(--dw-fill2)', w: 1 }) + Rct(x + w - 16, y + 4, 12, h - 8, { f: 'var(--dw-fill2)', w: 1 });
    const k = 16; for (let i = 1; i <= k; i++) { const xx = x + 18 + i * (w - 36) / (k + 1); s += L(xx.toFixed(1), y + 10, xx.toFixed(1), y + h - 10, { c: 'var(--dw-thin)', w: 1.1 }); }
    s += L(x + 18, y + h / 2, x + w - 18, y + h / 2, { c: 'var(--dw-thin)', w: 0.8, d: '2 3' });
    s += T(x + 10, y - 5, '+', { a: 'middle', s: 14, w: 700 }) + T(x + w - 10, y - 5, '−', { a: 'middle', s: 14, w: 700 });
    return s;
  };
  S.vessel = function (x, y, w, h, o) {
    o = o || {}; const ry = w / 4;
    let s = P('M' + x + ',' + (y + ry) + ' A' + (w / 2) + ',' + ry + ' 0 0 1 ' + (x + w) + ',' + (y + ry) + ' V' + (y + h - ry) + ' A' + (w / 2) + ',' + ry + ' 0 0 1 ' + x + ',' + (y + h - ry) + ' Z', { f: 'var(--dw-fill)', w: 1.6 });
    if (o.level !== false) s += L(x + 3, y + h * 0.62, x + w - 3, y + h * 0.62, { c: col(o.liq || 'lye'), w: 1.2, d: '5 3' });
    if (o.demister !== false) s += '<rect x="' + (x + 3) + '" y="' + (y + ry + 6) + '" width="' + (w - 6) + '" height="8" fill="url(#xhatch)" stroke="var(--dw-thin)" stroke-width="0.8"/>';
    return s;
  };
  S.hvessel = function (x, y, w, h) { const rx = h / 2; return Rct(x, y, w, h, { rx, w: 1.6 }); };
  S.hx = function (cx, cy, r) { return Cir(cx, cy, r, { w: 1.6 }) + P('M' + (cx - r) + ',' + cy + ' L' + (cx - r / 2) + ',' + (cy - r / 2) + ' L' + cx + ',' + (cy + r / 2) + ' L' + (cx + r / 2) + ',' + (cy - r / 2) + ' L' + (cx + r) + ',' + cy, { w: 1.4 }); };
  S.pump = function (cx, cy, r) { return Cir(cx, cy, r, { w: 1.6 }) + L(cx, cy - r, cx + r + 4, cy - r, { w: 1.6 }) + P('M' + (cx - r * 0.75) + ',' + (cy + r * 0.66) + ' L' + (cx - r) + ',' + (cy + r + 5) + ' L' + (cx + r) + ',' + (cy + r + 5) + ' L' + (cx + r * 0.75) + ',' + (cy + r * 0.66), { w: 1.3 }); };
  S.compressor = function (cx, cy, r) { return Cir(cx, cy, r, { w: 1.7 }) + L(cx - r * 0.62, cy - r * 0.78, cx + r * 0.62, cy - r * 0.4, { w: 1.4 }) + L(cx - r * 0.62, cy + r * 0.78, cx + r * 0.62, cy + r * 0.4, { w: 1.4 }); };
  S.reactor = function (x, y, w, h) { return S.vessel(x, y, w, h, { level: false, demister: false }) + '<rect x="' + (x + 2) + '" y="' + (y + h * 0.32) + '" width="' + (w - 4) + '" height="' + (h * 0.36) + '" fill="url(#xhatch)" stroke="var(--dw-ink)" stroke-width="0.9"/>'; };
  S.dryer = function (x, y, w, h) { const vw = w * 0.4; return S.vessel(x, y, vw, h, { level: false, demister: false }) + S.vessel(x + w - vw, y, vw, h, { level: false, demister: false }) + '<rect x="' + (x + 2) + '" y="' + (y + h * 0.28) + '" width="' + (vw - 4) + '" height="' + (h * 0.45) + '" fill="url(#dots)"/>' + '<rect x="' + (x + w - vw + 2) + '" y="' + (y + h * 0.28) + '" width="' + (vw - 4) + '" height="' + (h * 0.45) + '" fill="url(#dots)"/>' + L(x + vw, y + h * 0.2, x + w - vw, y + h * 0.2, { w: 1 }) + L(x + vw, y + h * 0.8, x + w - vw, y + h * 0.8, { w: 1 }); };
  S.storage = function (x, y, w, h) { const bh = (h - 8) / 3; let s = ''; for (let i = 0; i < 3; i++) s += Rct(x, y + i * (bh + 4), w, bh, { rx: bh / 2, w: 1.5 }); return s; };
  S.tank = function (x, y, w, h, liq) { return P('M' + x + ',' + (y + h) + ' L' + x + ',' + (y + 10) + ' L' + (x + w / 2) + ',' + y + ' L' + (x + w) + ',' + (y + 10) + ' L' + (x + w) + ',' + (y + h) + ' Z', { f: 'var(--dw-fill)', w: 1.6 }) + L(x + 3, y + h * 0.45, x + w - 3, y + h * 0.45, { c: col(liq || 'water'), w: 1.2, d: '5 3' }); };
  S.membrane = function (x, y, w, h, txt) { return Rct(x, y, w, h, { w: 1.6 }) + L(x, y + h, x + w, y, { w: 1.2 }) + (txt ? T(x + w * 0.28, y + h * 0.32, txt, { a: 'middle', s: 10, w: 700 }) : ''); };
  S.aircooler = function (x, y, w, h) {
    let s = Rct(x, y + h * 0.45, w, h * 0.55, { w: 1.6 });
    for (let i = 1; i < 8; i++) s += L(x + i * w / 8, y + h * 0.45 + 3, x + i * w / 8, y + h - 3, { c: 'var(--dw-thin)', w: 0.8 });
    const nf = Math.max(2, Math.round(w / 55)); for (let i = 0; i < nf; i++) { const cx = x + (i + 0.5) * w / nf, cy = y + h * 0.22, r = Math.min(h * 0.2, w / nf / 2 - 3); s += Cir(cx, cy, r, { w: 1.2 }) + L(cx - r * 0.7, cy - r * 0.7, cx + r * 0.7, cy + r * 0.7, { w: 1 }) + L(cx - r * 0.7, cy + r * 0.7, cx + r * 0.7, cy - r * 0.7, { w: 1 }) + L(cx, cy + r, cx, y + h * 0.45, { w: 1 }); }
    return s;
  };
  S.pv = function (x, y, w, h) {
    let s = ''; const n = 3, pw = w / n - 6;
    for (let i = 0; i < n; i++) { const px = x + i * (w / n) + 3; s += '<polygon points="' + [[px + 8, y], [px + pw, y], [px + pw - 8, y + h * 0.72], [px, y + h * 0.72]].map(p => p.join(',')).join(' ') + '" fill="url(#pvcells)" stroke="var(--dw-ink)" stroke-width="1.3"/>' + L(px + pw / 2 - 4, y + h * 0.72, px + pw / 2 - 4, y + h, { w: 1.3 }); }
    return s + L(x, y + h, x + w, y + h, { w: 1.2 });
  };
  S.wind = function (cx, y, h) {
    const hy = y + h * 0.34, bl = h * 0.34; let s = P('M' + (cx - 3) + ',' + (y + h) + ' L' + (cx - 1.4) + ',' + hy + ' L' + (cx + 1.4) + ',' + hy + ' L' + (cx + 3) + ',' + (y + h) + ' Z', { f: 'var(--dw-fill2)', w: 1.2 });
    [-90, 30, 150].forEach(a => { const r = a * Math.PI / 180; s += P('M' + cx + ',' + hy + ' L' + (cx + bl * Math.cos(r)).toFixed(1) + ',' + (hy + bl * Math.sin(r)).toFixed(1), { w: 2.4 }); });
    return s + Cir(cx, hy, 3.5, { w: 1.2 }) + L(cx - 14, y + h, cx + 14, y + h, { w: 1.2 });
  };
  S.battery = function (x, y, w, h) {
    let s = Rct(x, y, w, h, { rx: 2, w: 1.6 }); const n = 3, cw = (w - 16) / n;
    for (let i = 0; i < n; i++) { const cx = x + 8 + i * cw; s += Rct(cx + 3, y + h * 0.3, cw - 6, h * 0.5, { f: 'var(--dw-fill2)', w: 1 }) + Rct(cx + cw / 2 - 3, y + h * 0.3 - 4, 6, 4, { f: 'var(--dw-ink)', w: 0 }); }
    return s;
  };
  S.gridTower = function (cx, y, h) {
    const w = h * 0.45; let s = P('M' + (cx - w / 2) + ',' + (y + h) + ' L' + cx + ',' + y + ' L' + (cx + w / 2) + ',' + (y + h), { w: 1.5 });
    s += L(cx - w * 0.55, y + h * 0.25, cx + w * 0.55, y + h * 0.25, { w: 1.4 }) + L(cx - w * 0.42, y + h * 0.45, cx + w * 0.42, y + h * 0.45, { w: 1.3 });
    s += P('M' + (cx - w * 0.33) + ',' + (y + h * 0.7) + ' L' + (cx + w * 0.2) + ',' + (y + h * 0.45) + ' M' + (cx + w * 0.33) + ',' + (y + h * 0.7) + ' L' + (cx - w * 0.2) + ',' + (y + h * 0.45), { w: 0.9 });
    return s;
  };
  S.transformer = function (cx, cy, r, vertical) { return vertical ? Cir(cx, cy - r * 0.6, r, { f: 'none', w: 1.6 }) + Cir(cx, cy + r * 0.6, r, { f: 'none', w: 1.6 }) : Cir(cx - r * 0.6, cy, r, { f: 'none', w: 1.6 }) + Cir(cx + r * 0.6, cy, r, { f: 'none', w: 1.6 }); };
  S.converter = function (cx, cy, s, kind) {
    const h = s / 2; let o = Rct(cx - h, cy - h, s, s, { w: 1.6 }) + L(cx - h, cy + h, cx + h, cy - h, { w: 1.2 });
    const acT = 'M' + (cx - h * 0.8) + ',' + (cy - h * 0.45) + ' q' + (h * 0.15) + ',-' + (h * 0.3) + ' ' + (h * 0.3) + ',0 t' + (h * 0.3) + ',0';
    const dcB = 'M' + (cx + h * 0.15) + ',' + (cy + h * 0.45) + ' h' + (h * 0.6) + ' M' + (cx + h * 0.15) + ',' + (cy + h * 0.62) + ' h' + (h * 0.6);
    const acB = 'M' + (cx + h * 0.1) + ',' + (cy + h * 0.55) + ' q' + (h * 0.15) + ',-' + (h * 0.3) + ' ' + (h * 0.3) + ',0 t' + (h * 0.3) + ',0';
    const dcT = 'M' + (cx - h * 0.8) + ',' + (cy - h * 0.55) + ' h' + (h * 0.6) + ' M' + (cx - h * 0.8) + ',' + (cy - h * 0.38) + ' h' + (h * 0.6);
    return o + (kind === 'inv' ? P(dcT, { w: 1.2 }) + P(acB, { w: 1.2 }) : P(acT, { w: 1.2 }) + P(dcB, { w: 1.2 }));
  };
  // circuit breaker, IEC 60617 S00288 (07-13-05): make contact with the breaker cross at the fixed contact, drawn over a vertical line
  S.breaker = function (cx, cy, s) {
    s = s || 10; const h = s / 2, q = s * 0.2;
    return Rct(cx - h * 0.9, cy - h, h * 1.8, s, { f: 'var(--dw-sheet)', c: 'none', w: 0 }) +
      L(cx, cy + h, cx - h * 0.95, cy - h * 0.8, { w: 1.5 }) + L(cx - q, cy - h - q, cx + q, cy - h + q, { w: 1.3 }) + L(cx - q, cy - h + q, cx + q, cy - h - q, { w: 1.3 });
  };
  S.vent = function (x, y, h) { let s = Rct(x - 5, y, 10, h, { f: 'var(--dw-fill2)', w: 1.4 }); s += P('M' + (x - 9) + ',' + (y - 4) + ' L' + (x - 5) + ',' + y + ' M' + x + ',' + (y - 8) + ' L' + x + ',' + y + ' M' + (x + 9) + ',' + (y - 4) + ' L' + (x + 5) + ',' + y, { w: 1.1, c: 'var(--dw-ink2)' }); return s; };
  S.column = function (x, y, w, h) { let s = S.vessel(x, y, w, h, { level: false, demister: false }); for (let i = 1; i < 7; i++) s += L(x + 3, y + h * 0.12 + i * h * 0.11, x + w - 3, y + h * 0.12 + i * h * 0.11, { c: 'var(--dw-thin)', w: 1 }); return s; };
  S.dispenser = function (x, y, w, h) { return Rct(x, y, w, h, { rx: 3, w: 1.6 }) + Rct(x + 6, y + 8, w - 12, h * 0.3, { f: 'var(--dw-fill2)', w: 1 }) + P('M' + (x + w) + ',' + (y + h * 0.55) + ' C' + (x + w + 22) + ',' + (y + h * 0.55) + ' ' + (x + w + 22) + ',' + (y + h * 0.95) + ' ' + (x + w + 10) + ',' + (y + h * 0.95), { w: 2 }) + Rct(x + w + 3, y + h * 0.9, 10, 6, { f: 'var(--dw-ink)', w: 0 }); };
  S.valve = function (cx, cy, s, vertical) { s = s || 8; return vertical ? P('M' + (cx - s) + ',' + (cy - s) + ' L' + (cx + s) + ',' + (cy - s) + ' L' + (cx - s) + ',' + (cy + s) + ' L' + (cx + s) + ',' + (cy + s) + ' Z', { f: 'var(--dw-sheet)', w: 1.3 }) : P('M' + (cx - s) + ',' + (cy - s) + ' L' + (cx + s) + ',' + (cy + s) + ' L' + (cx + s) + ',' + (cy - s) + ' L' + (cx - s) + ',' + (cy + s) + ' Z', { f: 'var(--dw-sheet)', w: 1.3 }); };
  S.filter = function (cx, cy, s) { return P('M' + (cx - s) + ',' + cy + ' L' + cx + ',' + (cy - s) + ' L' + (cx + s) + ',' + cy + ' L' + cx + ',' + (cy + s) + ' Z', { f: 'var(--dw-fill)', w: 1.4 }) + L(cx - s * 0.7, cy - s * 0.3, cx + s * 0.7, cy + s * 0.3, { c: 'var(--dw-thin)', w: 1 }); };
  S.ground = function (cx, cy) { return L(cx, cy, cx, cy + 6, { w: 1.2 }) + L(cx - 8, cy + 6, cx + 8, cy + 6, { w: 1.4 }) + L(cx - 5, cy + 9, cx + 5, cy + 9, { w: 1.2 }) + L(cx - 2, cy + 12, cx + 2, cy + 12, { w: 1 }); };
  S.sun = function (cx, cy, r) { let s = Cir(cx, cy, r, { f: 'var(--st-elec)', c: 'var(--st-elec)', w: 1 }); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; s += L((cx + (r + 3) * Math.cos(a)).toFixed(1), (cy + (r + 3) * Math.sin(a)).toFixed(1), (cx + (r + 8) * Math.cos(a)).toFixed(1), (cy + (r + 8) * Math.sin(a)).toFixed(1), { c: 'var(--st-elec)', w: 1.4 }); } return s; };

  const localDate = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  F.localDate = localDate;
  // date of issue of the drawings: set by the application (date of the project version), otherwise today
  let ISSUE = null;
  F.setIssueDate = d => { ISSUE = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null; };
  F.issueDate = () => ISSUE || localDate();
  const DOCTYPE = { PFD: 'Process flow diagram', SLD: 'Single-line diagram', SNK: 'Balance diagram', CEL: 'Component drawing', STK: 'Arrangement drawing', WTR: 'Process flow diagram', CMP: 'Process flow diagram', LAY: 'Plot plan' };
  /* ---------- drawing sheet with frame and title block (ISO 7200 data fields) ---------- */
  F.sheet = function (o) {
    const W = o.w || 1500, H = o.h || 1060, m = 16, tbW = Math.min(620, W * 0.46), tbH = 92, doc = o.doc || {};
    let s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="var(--dw-sheet)"/>';
    s += '<rect x="' + (m - 8) + '" y="' + (m - 8) + '" width="' + (W - 2 * m + 16) + '" height="' + (H - 2 * m + 16) + '" fill="none" stroke="var(--dw-thin)" stroke-width="0.8"/>';
    s += '<rect x="' + m + '" y="' + m + '" width="' + (W - 2 * m) + '" height="' + (H - 2 * m) + '" fill="none" stroke="var(--dw-ink)" stroke-width="1.6"/>';
    const nz = 8, mz = 6; for (let i = 0; i < nz; i++) { const x = m + (i + 0.5) * (W - 2 * m) / nz; s += T(x, m - 1.5, String(i + 1), { a: 'middle', s: 7.5, c: 'var(--dw-ink2)' }) + T(x, H - m + 7.5, String(i + 1), { a: 'middle', s: 7.5, c: 'var(--dw-ink2)' }); if (i) s += L(m + i * (W - 2 * m) / nz, m - 8, m + i * (W - 2 * m) / nz, m, { c: 'var(--dw-thin)', w: 0.8 }) + L(m + i * (W - 2 * m) / nz, H - m, m + i * (W - 2 * m) / nz, H - m + 8, { c: 'var(--dw-thin)', w: 0.8 }); }
    for (let j = 0; j < mz; j++) { const y = m + (j + 0.5) * (H - 2 * m) / mz; const ch = 'ABCDEF'[j]; s += T(m - 4, y + 3, ch, { a: 'middle', s: 7.5, c: 'var(--dw-ink2)' }) + T(W - m + 4, y + 3, ch, { a: 'middle', s: 7.5, c: 'var(--dw-ink2)' }); }
    // title block: identification (title, number, revision, date of issue, sheet), legal owner, document type, creator and approver
    const tx = W - m - tbW, ty = H - m - tbH;
    const c1 = tx + tbW * 0.36, r1 = ty + 24, r2 = ty + 47, r3 = ty + 70, r4 = ty + 81;
    const cut = (v, n) => { v = String(v == null ? '' : v); return v.length > n ? v.slice(0, n - 1) + '…' : v; };
    const lbl = (x, y, t) => T(x, y, t, { s: 6.3, c: 'var(--dw-ink2)', w: 700 });
    s += '<g class="tblock"><rect x="' + tx + '" y="' + ty + '" width="' + tbW + '" height="' + tbH + '" fill="var(--dw-sheet)" stroke="var(--dw-ink)" stroke-width="1.4"/>';
    s += L(c1, ty, c1, r3, { w: 0.9 }) + L(tx, r1, tx + tbW, r1, { w: 0.9 }) + L(tx, r2, tx + tbW, r2, { w: 0.9 }) + L(tx, r3, tx + tbW, r3, { w: 0.9 }) + L(tx, r4, tx + tbW, r4, { w: 0.6, c: 'var(--dw-thin)' });
    s += '<rect x="' + (tx + 6) + '" y="' + (ty + 4) + '" width="15" height="15" rx="4" fill="var(--dw-brand)"/>' + T(tx + 13.5, ty + 14.5, 'H₂', { a: 'middle', s: 8, w: 700, c: '#ffffff' });
    s += T(tx + 26, ty + 11.5, 'Hasim Engineering Suite', { s: 9.8, w: 700 }) + T(tx + 26, ty + 20.5, 'Software © 2026 ' + OWNER, { s: 7.2, c: 'var(--dw-ink2)' });
    s += lbl(tx + 5, r1 + 8, 'LEGAL OWNER') + T(tx + 5, r1 + 18.5, cut(doc.owner || '–', 38), { s: 8.6, w: 600 });
    s += lbl(tx + 5, r2 + 8, 'PROJECT / SITE') + T(tx + 5, r2 + 18.5, cut((o.project || '') + (o.site ? ' · ' + o.site : ''), 40), { s: 8.2, w: 600 });
    s += lbl(c1 + 5, ty + 8, 'TITLE') + T(c1 + 5, ty + 19.5, cut(o.title || '', 52), { s: 10.8, w: 700 });
    const cw = (tbW - (c1 - tx)) / 5;
    ['DWG NO.', 'REV.', 'SCALE', 'DATE OF ISSUE', 'SHEET'].forEach((k, i) => { const x0 = c1 + i * cw; if (i) s += L(x0, r1, x0, r2, { w: 0.9 }); s += lbl(x0 + 4, r1 + 8, k) + T(x0 + 4, r1 + 18.5, [o.dwg || '', o.rev || 'A', o.scale || 'NTS', o.date || F.issueDate(), o.sheet || '1 / 1'][i], { s: 8.6, w: 600 }); });
    const cw2 = (tbW - (c1 - tx)) / 3, dtype = DOCTYPE[String(o.dwg || '').slice(0, 3)] || 'Drawing';
    ['DOCUMENT TYPE', 'CREATED BY', 'APPROVED BY'].forEach((k, i) => { const x0 = c1 + i * cw2; if (i) s += L(x0, r2, x0, r3, { w: 0.9 }); s += lbl(x0 + 4, r2 + 8, k) + T(x0 + 4, r2 + 18.5, cut([dtype, doc.creator || 'Hasim (calculated)', doc.approver || '–'][i], 26), { s: 8.2, w: 600 }); });
    s += T(tx + 5, r3 + 8.2, cut(o.basis || 'Calculated by Hasim from the project design basis', 120), { s: 6.8, c: 'var(--dw-ink2)' });
    const lic = F.LICENSE_LINE ? ' · ' + F.LICENSE_LINE : ' · Unauthorised copying or distribution of the software is prohibited.';
    const maxc = Math.floor((tbW - 10) / 3.6), line = 'Software © 2026 ' + OWNER + ' – all rights reserved' + lic;
    s += T(tx + 5, r4 + 8.3, line.length > maxc ? line.slice(0, maxc - 1) + '…' : line, { s: 7, c: F.WATERMARK ? 'var(--st-o2)' : 'var(--dw-ink2)', w: F.WATERMARK ? 700 : null });
    s += '</g>';
    return { W, H, m, frame: s, tb: { x: tx, y: ty, w: tbW, h: tbH } };
  };
  let uidN = 0;
  F.wrap = function (sh, body, o) {
    o = o || {};
    const uid = 'd' + (++uidN) + Math.random().toString(36).slice(2, 6) + '-';
    const fix = str => str.replace(/url\(#(ah-|hatch|xhatch|dots|pvcells|grass|clipbox)/g, 'url(#' + uid + '$1').replace(/id="(ah-|hatch|xhatch|dots|pvcells|grass|clipbox)/g, 'id="' + uid + '$1');
    return fix('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + sh.W + ' ' + sh.H + '" data-w="' + sh.W + '" data-h="' + sh.H + '" font-family="Arial, \'Liberation Sans\', Helvetica, sans-serif" class="dwg" role="img" aria-label="' + esc(o.title || 'drawing') + '">' +
      '<title>' + esc((o.title || 'Drawing') + ' – Hasim – © 2026 ' + OWNER) + '</title><desc>' + esc('Hasim Engineering Suite. Owner and developer: ' + OWNER + '. All rights reserved.') + '</desc>' +
      F.defs() + sh.frame + body + F.watermark(sh.W, sh.H) + '</svg>');
  };
  // evaluation / viewer watermark (set by the licence module)
  F.watermark = function (W, H) {
    if (!F.WATERMARK) return '';
    const t = (x, y, sz) => '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="' + sz + '" font-weight="700" fill="#c0392b" opacity="0.13" transform="rotate(-22 ' + x + ' ' + y + ')" letter-spacing="2">' + esc(F.WATERMARK) + '</text>';
    return '<g class="wm" pointer-events="none">' + t(W / 2, H / 2, Math.round(W / 26)) + t(W * 0.27, H * 0.24, Math.round(W / 60)) + t(W * 0.73, H * 0.78, Math.round(W / 60)) + '</g>';
  };
  // legend of line types
  F.legend = function (x, y, types, o) {
    o = o || {}; let s = '', cx = x, cy = y; const maxW = o.maxW || 1e9;
    types.forEach(t => { const nm = F.STREAM_NAMES[t] || t; const w = 40 + nm.length * 5.4; if (cx + w - x > maxW) { cx = x; cy += 16; } s += F.line([[cx, cy], [cx + 24, cy]], t, { arrow: false, w: t === 'dc' ? 3 : 2 }) + T(cx + 29, cy + 4, nm, { s: o.s || 10 }); cx += w; });
    return s;
  };
  F.note = function (x, y, lines, o) { o = o || {}; let s = T(x, y, o.title || 'NOTES', { s: 9.5, w: 700 }); lines.forEach((l, i) => { s += T(x, y + 14 + i * 12.5, (o.num === false ? '' : (i + 1) + '. ') + l, { s: 9, c: 'var(--dw-ink2)' }); }); return s; };
  // table drawn in SVG
  F.table = function (x, y, cols, rows, o) {
    o = o || {}; const rh = o.rh || 17, fs = o.s || 9.5; const W = cols.reduce((a, c) => a + c.w, 0);
    let s = '<rect x="' + x + '" y="' + y + '" width="' + W + '" height="' + rh + '" fill="var(--dw-fill2)" stroke="var(--dw-ink)" stroke-width="1"/>';
    let cx = x; cols.forEach(c => { s += T(c.a === 'end' ? cx + c.w - 4 : cx + 4, y + rh - 5, c.t, { s: fs - 0.5, w: 700, a: c.a === 'end' ? 'end' : null }); cx += c.w; });
    rows.forEach((r, i) => {
      const yy = y + rh * (i + 1);
      s += '<g' + (r._id ? ' class="trow" data-stream="' + esc(r._id) + '"' : '') + '><rect x="' + x + '" y="' + yy + '" width="' + W + '" height="' + rh + '" fill="' + (i % 2 ? 'var(--dw-fill)' : 'var(--dw-sheet)') + '" stroke="var(--dw-thin)" stroke-width="0.6"/>';
      cx = x; cols.forEach((c, k) => { const v = r[k]; s += T(c.a === 'end' ? cx + c.w - 4 : cx + 4, yy + rh - 5, typeof v === 'number' ? fv(v, c.d) : (v == null ? '' : String(v)).slice(0, c.max || 60), { s: fs, a: c.a === 'end' ? 'end' : null, w: k === 0 ? 700 : null, c: r._c && k === 0 ? r._c : null }); cx += c.w; });
      s += '</g>';
    });
    let vx = x; cols.forEach((c, k) => { if (k) s += L(vx, y, vx, y + rh * (rows.length + 1), { c: 'var(--dw-thin)', w: 0.6 }); vx += c.w; });
    s += '<rect x="' + x + '" y="' + y + '" width="' + W + '" height="' + rh * (rows.length + 1) + '" fill="none" stroke="var(--dw-ink)" stroke-width="1"/>';
    return s;
  };

  /* ---------- Sankey layout ---------- */
  F.sankey = function (links, box, o) {
    o = o || {};
    const nodes = {}; const order = [];
    const node = nm => { if (!nodes[nm]) { nodes[nm] = { name: nm, in: 0, out: 0, src: [], dst: [], col: 0 }; order.push(nm); } return nodes[nm]; };
    links.forEach(l => { const a = node(l.s), b = node(l.t); a.out += l.v; b.in += l.v; a.dst.push(l); b.src.push(l); });
    for (let it = 0; it < order.length; it++) links.forEach(l => { nodes[l.t].col = Math.max(nodes[l.t].col, nodes[l.s].col + 1); });
    order.forEach(k => { const nd = nodes[k]; if (nd.in === 0 && nd.dst.length) nd.col = Math.max(0, Math.min(...nd.dst.map(l => nodes[l.t].col)) - 1); });
    const ncol = Math.max(...order.map(k => nodes[k].col)) + 1;
    const cols = Array.from({ length: ncol }, () => []); order.forEach(k => cols[nodes[k].col].push(nodes[k]));
    const nodeW = o.nodeW || 16, pad = o.pad || 26;
    const val = nd => Math.max(nd.in, nd.out);
    const maxSum = Math.max(...cols.map(c => c.reduce((a, nd) => a + val(nd), 0) + 0));
    const maxN = Math.max(...cols.map(c => c.length));
    const k = (box.h - pad * (maxN - 1)) / maxSum;
    cols.forEach((c, ci) => {
      const tot = c.reduce((a, nd) => a + val(nd) * k, 0) + pad * (c.length - 1);
      let y = box.y + (box.h - tot) / 2;
      const x = box.x + (ncol === 1 ? 0 : ci * (box.w - nodeW) / (ncol - 1));
      c.forEach(nd => { nd.x = x; nd.y = y; nd.h = Math.max(2, val(nd) * k); y += nd.h + pad; });
    });
    order.forEach(nm => { const nd = nodes[nm]; nd.dst.sort((a, b) => nodes[a.t].y - nodes[b.t].y); nd.src.sort((a, b) => nodes[a.s].y - nodes[b.s].y); let oy = nd.y; nd.dst.forEach(l => { l.sy = oy; l.w = l.v * k; oy += l.w; }); let iy = nd.y; nd.src.forEach(l => { l.ty = iy; iy += l.v * k; }); });
    links.forEach(l => { const a = nodes[l.s], b = nodes[l.t]; const x0 = a.x + nodeW, x1 = b.x, y0 = l.sy + l.w / 2, y1 = l.ty + l.w / 2, xm = (x0 + x1) / 2; l.path = 'M' + x0 + ',' + y0.toFixed(1) + ' C' + xm + ',' + y0.toFixed(1) + ' ' + xm + ',' + y1.toFixed(1) + ' ' + x1 + ',' + y1.toFixed(1); });
    return { nodes: order.map(k2 => nodes[k2]), links, k, nodeW, ncol };
  };

  /* ---------- interactive viewer: zoom, pan, selection, tooltips ---------- */
  F.viewer = function (host, svgMarkup, o) {
    o = o || {};
    host.innerHTML = '';
    host.classList.add('dview');
    const bar = document.createElement('div'); bar.className = 'dview-bar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Drawing tools');
    const btn = (label, title, fn, t) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tbtn'; b.innerHTML = label; b.title = title; b.onclick = fn; if (!b.textContent.trim() || (t && t.aria)) b.setAttribute('aria-label', (t && t.aria) || title); if (t && t.pressed != null) b.setAttribute('aria-pressed', t.pressed ? 'true' : 'false'); bar.appendChild(b); return b; };
    const canvas = document.createElement('div'); canvas.className = 'dview-canvas';
    canvas.innerHTML = svgMarkup;
    const svg = canvas.querySelector('svg');
    const W = +svg.getAttribute('data-w'), H = +svg.getAttribute('data-h');
    let vb = { x: 0, y: 0, w: W, h: H };
    const apply = () => { svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h); zl.textContent = Math.round(W / vb.w * 100) + ' %'; };
    const zoom = (f, cx, cy) => { cx = cx == null ? vb.x + vb.w / 2 : cx; cy = cy == null ? vb.y + vb.h / 2 : cy; const nw = Math.min(W * 1.5, Math.max(W / 12, vb.w / f)); const nh = nw * H / W; vb = { x: cx - (cx - vb.x) * nw / vb.w, y: cy - (cy - vb.y) * nh / vb.h, w: nw, h: nh }; apply(); };
    const fit = () => { vb = { x: 0, y: 0, w: W, h: H }; apply(); };
    btn('<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.8"/><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M11 11l4 4" stroke="currentColor" stroke-width="1.8"/></svg>', 'Zoom in (+)', () => zoom(1.35));
    btn('<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 7h8" stroke="currentColor" stroke-width="1.8"/><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M11 11l4 4" stroke="currentColor" stroke-width="1.8"/></svg>', 'Zoom out (−)', () => zoom(1 / 1.35));
    btn('<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M1 5V1h4M11 1h4v4M15 11v4h-4M5 15H1v-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>', 'Fit sheet (0 or double-click)', fit);
    const zl = document.createElement('span'); zl.className = 'zlevel'; bar.appendChild(zl);
    const sp = document.createElement('span'); sp.className = 'grow'; bar.appendChild(sp);
    (o.tools || []).forEach(t => btn(t.label, t.title || t.label, t.fn, t));
    btn('<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1v9M4 6l4 4 4-4M2 12v3h12v-3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg> SVG', 'Export drawing as SVG', () => {
      const c = svg.cloneNode(true); c.setAttribute('viewBox', '0 0 ' + W + ' ' + H); c.querySelectorAll('.sel').forEach(n => n.classList.remove('sel')); F.inlineVars(c, host, true);
      c.querySelectorAll('[tabindex]').forEach(n => { n.removeAttribute('tabindex'); n.removeAttribute('role'); n.removeAttribute('aria-label'); }); c.setAttribute('role', 'img');   // the file keeps the plain drawing
      root.download((o.file || 'Hasim_drawing') + '.svg', '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Hasim Engineering Suite – © 2026 ' + OWNER + '. All rights reserved. -->\n' + new XMLSerializer().serializeToString(c), 'image/svg+xml');
    }, { aria: 'SVG – export the drawing' });
    host.appendChild(bar); host.appendChild(canvas);
    const tip = document.createElement('div'); tip.className = 'dtip'; tip.setAttribute('aria-hidden', 'true'); host.appendChild(tip);
    apply();
    // keyboard: the canvas and one hotspot per equipment tag and per stream are focusable buttons
    const cesc = v => (root.CSS && CSS.escape ? CSS.escape(v) : String(v));
    const title = svg.getAttribute('aria-label') || 'Drawing';
    svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', title);
    canvas.tabIndex = 0; canvas.setAttribute('role', 'group'); canvas.setAttribute('aria-roledescription', 'drawing');
    canvas.setAttribute('aria-label', title + ' – arrow keys pan, plus and minus zoom, 0 fits the sheet; Tab moves between equipment and streams, Enter selects');
    const seenT = new Set(), seenS = new Set();
    svg.querySelectorAll('[data-tag]').forEach(n => { const t = n.getAttribute('data-tag'); if (seenT.has(t)) return; seenT.add(t);
      n.setAttribute('tabindex', '0'); n.setAttribute('role', 'button'); n.setAttribute('aria-label', o.nameTag ? o.nameTag(t) : t); });
    svg.querySelectorAll('[data-stream]').forEach(n => { const id = n.getAttribute('data-stream'); if (seenS.has(id)) return; seenS.add(id);
      const h0 = svg.querySelector('.stag[data-stream="' + cesc(id) + '"]') || n;
      h0.setAttribute('tabindex', '0'); h0.setAttribute('role', 'button'); h0.setAttribute('aria-label', o.nameStream ? o.nameStream(id) : 'Stream ' + id.replace(/^S/, '')); });
    const hotspot = el => { if (!el) return null; const t = el.getAttribute('data-tag'), s = t == null ? el.getAttribute('data-stream') : null;
      return t != null ? svg.querySelector('[data-tag="' + cesc(t) + '"][tabindex]') : s != null ? svg.querySelector('[data-stream="' + cesc(s) + '"][tabindex]') : null; };
    function selectEl(el, focus) {
      svg.querySelectorAll('.sel').forEach(n => n.classList.remove('sel'));
      if (el.hasAttribute('data-tag')) { el.classList.add('sel'); o.onSelect && o.onSelect({ tag: el.getAttribute('data-tag') }); }
      else { const id = el.getAttribute('data-stream'); svg.querySelectorAll('[data-stream="' + cesc(id) + '"]').forEach(n => n.classList.add('sel')); o.onSelect && o.onSelect({ stream: id }); }
      const hs = hotspot(el); if (focus && hs && document.activeElement !== hs) hs.focus({ preventScroll: true });
    }
    function tipAt(el) {
      const tg = el.getAttribute('data-tag'), st = el.getAttribute('data-stream');
      const html = tg != null && o.tipTag ? o.tipTag(tg) : st != null && o.tipStream ? o.tipStream(st) : null; if (!html) { tip.style.display = 'none'; return; }
      tip.innerHTML = html; tip.style.display = 'block';
      const hr = host.getBoundingClientRect(), r = el.getBoundingClientRect();
      let lx = r.right - hr.left + 10; if (lx > hr.width - 270) lx = Math.max(4, r.left - hr.left - 280); tip.style.left = lx + 'px'; tip.style.top = Math.max(4, r.top - hr.top) + 'px';
    }
    // bring a hotspot that received the focus into view
    function reveal(el) {
      const cr = canvas.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (r.left >= cr.left && r.right <= cr.right && r.top >= cr.top && r.bottom <= cr.bottom) return;
      try { const m = svg.getScreenCTM(); if (!m) return; const pt = svg.createSVGPoint(); pt.x = (r.left + r.right) / 2; pt.y = (r.top + r.bottom) / 2; const q = pt.matrixTransform(m.inverse()); vb.x = q.x - vb.w / 2; vb.y = q.y - vb.h / 2; apply(); } catch (e) { /* keep the view */ }
    }
    canvas.addEventListener('keydown', ev => {
      const k = ev.key, hs = ev.target.closest && ev.target.closest('[data-tag][tabindex], [data-stream][tabindex]');
      if ((k === 'Enter' || k === ' ') && hs) { ev.preventDefault(); selectEl(hs, true); tipAt(hs); return; }
      if (k === 'Escape' && tip.style.display === 'block') { tip.style.display = 'none'; ev.stopPropagation(); return; }
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      const pan = (dx, dy) => { vb.x += dx * vb.w; vb.y += dy * vb.h; apply(); };
      switch (k) {
        case 'ArrowLeft': pan(-0.1, 0); break; case 'ArrowRight': pan(0.1, 0); break; case 'ArrowUp': pan(0, -0.1); break; case 'ArrowDown': pan(0, 0.1); break;
        case '+': case '=': case 'Add': zoom(1.25); break; case '-': case '_': case 'Subtract': zoom(1 / 1.25); break; case '0': fit(); break;
        default: return;
      }
      ev.preventDefault(); tip.style.display = 'none';
    });
    canvas.addEventListener('focusin', ev => { const hs = ev.target.closest && ev.target.closest('[data-tag][tabindex], [data-stream][tabindex]'); if (!hs) return; reveal(hs); tipAt(hs); });
    canvas.addEventListener('focusout', () => { tip.style.display = 'none'; });
    // wheel zoom, drag pan
    canvas.addEventListener('wheel', ev => { if (!ev.ctrlKey && !o.wheelAlways && !canvas.classList.contains('focus')) return; ev.preventDefault(); const r = svg.getBoundingClientRect(); const px = vb.x + (ev.clientX - r.left) / r.width * vb.w, py = vb.y + (ev.clientY - r.top) / r.height * vb.h; zoom(ev.deltaY < 0 ? 1.15 : 1 / 1.15, px, py); }, { passive: false });
    canvas.addEventListener('mouseenter', () => canvas.classList.add('focus'));
    canvas.addEventListener('mouseleave', () => canvas.classList.remove('focus'));
    let drag = null;
    const onMove = ev => { if (!drag) return; const r = svg.getBoundingClientRect(); const dx = (ev.clientX - drag.x) / r.width * vb.w, dy = (ev.clientY - drag.y) / r.height * vb.h; if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) > 3) { drag.moved = true; canvas.classList.add('panning'); } if (drag.moved) { vb.x = drag.vb.x - dx; vb.y = drag.vb.y - dy; apply(); } };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
      if (drag && drag.moved) { canvas.dataset.justPanned = '1'; setTimeout(() => { delete canvas.dataset.justPanned; }, 50); } drag = null; canvas.classList.remove('panning');
    };
    canvas.addEventListener('pointerdown', ev => { if (ev.button !== 0) return; drag = { x: ev.clientX, y: ev.clientY, vb: Object.assign({}, vb), moved: false }; window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp); });
    canvas.addEventListener('dblclick', fit);
    // selection and tooltips
    canvas.addEventListener('click', ev => {
      if (canvas.dataset.justPanned) return;
      const e = ev.target.closest('[data-tag]'), s = ev.target.closest('[data-stream]');
      if (e) selectEl(e, false); else if (s) selectEl(s, false); else svg.querySelectorAll('.sel').forEach(n => n.classList.remove('sel'));
    });
    canvas.addEventListener('mousemove', ev => {
      const e = ev.target.closest('[data-tag]'), s = ev.target.closest('[data-stream]');
      const html = e && o.tipTag ? o.tipTag(e.dataset.tag) : s && o.tipStream ? o.tipStream(s.dataset.stream) : null;
      if (!html) { tip.style.display = 'none'; return; }
      tip.innerHTML = html; tip.style.display = 'block'; const hr = host.getBoundingClientRect();
      let lx = ev.clientX - hr.left + 16; if (lx > hr.width - 260) lx = ev.clientX - hr.left - 270; tip.style.left = lx + 'px'; tip.style.top = (ev.clientY - hr.top + 14) + 'px';
    });
    canvas.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
    return { svg, destroy: onUp, fit: () => { vb = { x: 0, y: 0, w: W, h: H }; apply(); }, select: tag => { svg.querySelectorAll('.sel').forEach(n => n.classList.remove('sel')); const n = svg.querySelector('[data-tag="' + tag + '"]'); if (n) n.classList.add('sel'); } };
  };
  // replace CSS variables by computed colours (for export)
  F.LIGHT = Object.freeze({ '--dw-sheet': '#ffffff', '--dw-ink': '#1d2733', '--dw-ink2': '#55616e', '--dw-thin': '#a9b3bd', '--dw-fill': '#f3f6f9', '--dw-fill2': '#e3e9ef', '--dw-brand': '#0b5f7a', '--dw-grid': '#e9edf1',
    '--st-h2': '#147a35', '--st-o2': '#c43b3b', '--st-water': '#1f6fd1', '--st-lye': '#7a4cc2', '--st-cool': '#0a7a7a', '--st-elec': '#c98a00', '--st-dc': '#b3541e', '--st-n2': '#56657a', '--st-nh3': '#8a5a17', '--st-air': '#5f7186', '--st-heat': '#e0661f', '--st-loss': '#9aa3ad', '--st-aux': '#4b6a8a',
    '--s1': '#2a78d6', '--s2': '#eb6834', '--s3': '#1baf7a', '--s4': '#eda100', '--s5': '#e87ba4', '--s6': '#008300', '--s7': '#4a3aa7', '--s8': '#e34948', '--grid': '#e6e9ec', '--axis': '#98a2ac',
    '--ink': '#15202b', '--ink2': '#44525f', '--muted': '#56626e', '--line': '#d4dbe2', '--surface': '#ffffff', '--surface2': '#f4f6f8', '--accent': '#0a6c93', '--h2c': '#178a3c', '--good': '#1b7d3a', '--warn': '#a85400', '--bad': '#c62828' });
  F.inlineVars = function (svg, host, light) {
    const cs = getComputedStyle(host);
    const res = v => v.replace(/var\((--[\w-]+)\)/g, (m, name) => (light && F.LIGHT[name]) || cs.getPropertyValue(name).trim() || '#000');
    svg.querySelectorAll('*').forEach(n => { ['stroke', 'fill', 'stop-color'].forEach(a => { const v = n.getAttribute(a); if (v && v.indexOf('var(') >= 0) n.setAttribute(a, res(v)); }); const st = n.getAttribute('style'); if (st && st.indexOf('var(') >= 0) n.setAttribute('style', res(st)); });
  };
})(typeof window !== 'undefined' ? window : globalThis);

;
/* Hasim – Green Hydrogen Engineering Suite. © 2026 Prof. Hani Muhsen. All rights reserved. */
/* =====================================================================
   Hasim – figures-pfd.js : Process Flow Diagram (PFD-001) with stream
   table, and Electrical Single-Line Diagram (SLD-001).
   Owner and developer: Prof. Hani Muhsen.
   ===================================================================== */
(function (root) {
  'use strict';
  const F = root.H2F, S = F.sym, T = F.T, L = F.L, fv = F.fv;
  const esc = F.esc;

  /* =================================================================
     PFD-001 PROCESS FLOW DIAGRAM
     ================================================================= */
  F.pfd = function (sys, o) {
    o = o || {};
    const b = sys.basis, tech = b.tech, isPEM = tech === 'PEM', isSOEC = tech === 'SOEC';
    const sh = F.sheet({ w: 1500, h: 1060, title: 'Process flow diagram', dwg: 'PFD-001', project: b.name, site: b.siteName || '', doc: b, basis: 'Design point: rated load, beginning of life. Pressures in bar(a).' });
    const st = {}; sys.streams.forEach(s => { st[s.key] = s; });
    const E = sys.E; let g = '';
    const tagS = (key, x, y) => st[key] ? F.tag(x, y, st[key].no, st[key].type, 'S' + st[key].no) : '';
    const ln = (key, pts, type, opt) => F.line(pts, type || (st[key] ? st[key].type : 'ink'), Object.assign({ id: st[key] ? 'S' + st[key].no : null }, opt || {}));
    const callout = (key, x, y, anchor) => {
      if (!o.labels || !st[key]) return ''; const s = st[key];
      const txt = [fv(s.m) + ' kg/h', fv(s.T, 0) + ' °C · ' + fv(s.p, s.p < 10 ? 1 : 0) + ' bar'];
      const w = 96, h = 28, x0 = anchor === 'end' ? x - w : x;
      return '<g class="callout"><rect x="' + x0 + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="var(--dw-sheet)" stroke="' + F.col(s.type) + '" stroke-width="1"/>' + T(x0 + 5, y + 11.5, txt[0], { s: 9.5, w: 700 }) + T(x0 + 5, y + 23, txt[1], { s: 9, c: 'var(--dw-ink2)' }) + '</g>';
    };
    /* ---------- power supply and MV bus (top left) ---------- */
    const busY = 172, busX0 = 50, busX1 = 640;
    const src = [];
    if (E['PV-001']) src.push({ tag: 'PV-001', name: sys.elec.ppa ? 'PV (PPA, off-site)' : 'PV plant', ppa: sys.elec.ppa, val: F.fvs(b.pvMWp) + ' MWp', draw: cx => S.pv(cx - 48, 76, 96, 52) });
    if (E['WT-001']) src.push({ tag: 'WT-001', name: sys.elec.ppa ? 'Wind (PPA, off-site)' : 'Wind farm', ppa: sys.elec.ppa, val: sys.elec.wind.n + ' × ' + F.fvs(sys.elec.wind.unit, 1) + ' MW', draw: cx => S.wind(cx, 64, 70) });
    if (E['BT-001']) src.push({ tag: 'BT-001', name: 'Battery (BESS)', val: F.fvs(b.batMW) + ' MW / ' + F.fvs(b.batMWh) + ' MWh', draw: cx => S.battery(cx - 38, 88, 76, 40) });
    if (E['GR-001']) src.push({ tag: 'GR-001', name: 'Grid connection', val: F.fvs(b.gridMW) + ' MW import', draw: cx => S.gridTower(cx, 66, 64) });
    src.forEach((sr, i) => {
      const cx = 105 + i * 128;
      g += F.eqg(sr.tag, sr.draw(cx) + F.label(cx, 45, sr.tag, sr.name));
      g += F.line([[cx, 132], [cx, busY]], 'elec', { arrow: false, dash: sr.ppa ? '6 4' : '' }) + S.breaker(cx, 152, 9) + T(cx + 8, 147, sr.val, { s: 9.5, c: 'var(--dw-ink2)' });
    });
    g += '<rect x="' + busX0 + '" y="' + (busY - 3) + '" width="' + (busX1 - busX0) + '" height="6" fill="var(--st-elec)"/>' + T(busX0 + 110, busY + 17, sys.elec.kV + ' kV MV busbar' + (sys.elec.islanded ? ' – islanded microgrid' : ''), { s: 10, w: 700 });
    // auxiliary transformer
    const axX = 130;
    g += F.eqg('TX-401', F.line([[axX, busY], [axX, 206]], 'elec', { arrow: false }) + S.transformer(axX, 222, 11, true) + F.line([[axX, 244], [axX, 270]], 'elec') + F.label(axX + 18, 216, 'TX-401', F.fvs(sys.elec.aux.S) + ' MVA / 0.4 kV', { a: 'start', s: 11 }));
    g += T(axX - 60, 284, 'Auxiliaries ' + fv(sys.elec.aux.MW, 1) + ' MW: compressors, pumps,', { s: 9, c: 'var(--dw-ink2)' }) + T(axX - 60, 296, 'water plant, coolers, controls', { s: 9, c: 'var(--dw-ink2)' });
    // rectifier feeder
    const rX = 590;
    g += F.line([[rX, busY], [rX, 196]], 'elec', { arrow: false }) + S.breaker(rX, 186, 9);
    g += F.eqg('TR-101', S.transformer(rX, 214, 12, true) + F.label(rX + 22, 208, 'TR-101', b.modules + ' × ' + F.fvs(sys.elec.modules.ST) + ' MVA', { a: 'start', s: 11 }));
    g += F.line([[rX, 238], [rX, 250]], 'elec', { arrow: false });
    g += F.eqg('RC-101', S.converter(rX, 268, 34) + F.label(rX + 22, 262, 'RC-101', sys.elec.modules.type, { a: 'start', s: 11, extra: fv(sys.elec.modules.Vdc, 0) + ' V · ' + fv(sys.elec.modules.Idc / 1000, 2) + ' kA' }));
    g += F.line([[rX, 285], [rX, 330]], 'dc', { arrow: true });
    /* ---------- electrolyser ---------- */
    const ex = 490, ey = 332, ew = 200, eh = 190;
    const cs = sys.cellStack;
    g += F.eqg('EL-101', S.electrolyser(ex, ey, ew, eh) + T(ex + ew / 2, ey + eh / 2 - 8, 'EL-101', { a: 'middle', s: 15, w: 700 }) + T(ex + ew / 2, ey + eh / 2 + 9, cs.techName + ' × ' + b.modules, { a: 'middle', s: 11, c: 'var(--dw-ink2)' }) + T(ex + ew / 2, ey + eh / 2 + 23, fv(cs.cell.Ecell, 3) + ' V · ' + fv(cs.j, 2) + ' A/cm²', { a: 'middle', s: 10, c: 'var(--dw-ink2)' }));
    g += T(ex + ew / 2, ey + eh / 2 + 37, F.fvs(b.modules * b.moduleMW) + ' MW · ' + cs.nStacks + ' stacks × ' + cs.cells + ' cells', { a: 'middle', s: 10, c: 'var(--dw-ink2)' }) + T(ex + ew / 2, ey + eh / 2 + 51, fv(sys.kpi.mStack) + ' kg/h H₂', { a: 'middle', s: 10, w: 700, c: 'var(--st-h2)' });
    /* ---------- water treatment (left) ---------- */
    const wx = 88, wy = 396;
    g += ln('raw', [[30, 420], [wx, 420]]) + tagS('raw', 58, 420) + callout('raw', 30, 430);
    g += F.eqg('WT-101', S.membrane(wx, wy, 80, 50, 'RO') + F.label(wx + 40, wy - 22, 'WT-101', 'RO + EDI'));
    g += ln('brine', [[wx + 40, wy + 50], [wx + 40, 520]]) + tagS('brine', wx + 40, 492) + F.offpage(wx + 8, 535, b.TDS > 10 ? 'Outfall' : 'Sewer', 'right', 'water');
    g += ln('di', [[wx + 80, 420], [226, 420]]) + tagS('di', 197, 420);
    g += F.eqg('TK-101', S.tank(226, 372, 58, 92, 'water') + F.label(255, 482, 'TK-101', 'DI tank ' + fv(sys.water.tank, 0) + ' m³'));
    g += F.eqg('P-101', S.pump(330, 474, 12) + F.label(338, 510, 'P-101', 'DI feed'));
    g += F.line([[284, 452], [306, 452], [306, 474], [318, 474]], 'water', { arrow: false });
    if (!isSOEC) g += ln('makeup', [[346, 462], [420, 462], [420, 440], [ex, 440]]) + tagS('makeup', 420, 452);
    // condensate return (off-page pair)
    g += F.offpage(222, 312, 'from E-102', 'right', 'water') + ln('cond', [[255, 321], [255, 372]]) + tagS('cond', 255, 345);
    /* ---------- electrolyte loop & separators ---------- */
    const v1 = { x: 760, y: 296, w: 60, h: 140 }, v2 = { x: 880, y: 420, w: 60, h: 140 };
    const hdrY = 630;
    if (!isSOEC) {
      g += ln('cath', [[ex + ew, 364], [v1.x, 364]]) + tagS('cath', 726, 364);
      g += ln('anod', [[ex + ew, 488], [v2.x, 488]]) + tagS('anod', 726, 488);
      g += F.eqg('V-101', S.vessel(v1.x, v1.y, v1.w, v1.h, { liq: 'lye' }) + F.label(v1.x - 6, v1.y + 18, 'V-101', 'H₂ separator', { a: 'end', s: 12 }));
      g += F.eqg('V-102', S.vessel(v2.x, v2.y, v2.w, v2.h, { liq: 'lye' }) + F.label(v2.x + v2.w + 8, v2.y + 58, 'V-102', 'O₂ separator', { a: 'start', s: 12 }));
      g += ln('ret', [[v1.x + 30, v1.y + v1.h], [v1.x + 30, hdrY], [735, hdrY]], 'lye') + F.line([[v2.x + 30, v2.y + v2.h], [v2.x + 30, hdrY], [v1.x + 30, hdrY]], 'lye', { arrow: false });
      g += tagS('ret', 850, hdrY);
      g += F.eqg('P-102', S.pump(720, hdrY, 14) + F.label(720, hdrY + 34, 'P-102', 'circulation'));
      g += F.line([[706, hdrY], [620, hdrY]], 'lye');
      g += F.eqg('E-101', S.hx(600, hdrY, 19) + F.label(560, hdrY - 26, 'E-101', isPEM ? 'water cooler' : 'lye cooler', { a: 'end', s: 12 }));
      g += ln('feed', [[600, hdrY - 19], [600, ey + eh]], 'lye') + tagS('feed', 600, 578);
      g += F.instr(662, 586, 'TIC', '101', 640, 600);
    } else {
      g += F.eqg('E-103', S.hx(600, hdrY, 19) + F.label(560, hdrY - 26, 'E-103', 'steam generator', { a: 'end', s: 12 }));
      g += ln('makeup', [[346, 462], [420, 462], [420, hdrY], [581, hdrY]], 'water');
      g += ln('steam', [[600, hdrY - 19], [600, ey + eh]], 'water') + tagS('steam', 600, 578);
      g += ln('cath', [[ex + ew, 364], [v1.x, 364]]) + tagS('cath', 726, 364);
      g += F.eqg('V-101', S.vessel(v1.x, v1.y, v1.w, v1.h, { liq: 'water' }) + F.label(v1.x - 6, v1.y + 18, 'V-101', 'knock-out drum', { a: 'end', s: 12 }));
      g += ln('anod', [[ex + ew, 488], [1004, 488], [1004, 408]], 'o2') + tagS('anod', 800, 488);
    }
    /* ---------- coolant loop & dry coolers ---------- */
    const cx0 = 350, cy0 = 604;
    g += F.eqg('CL-401', S.aircooler(cx0, cy0, 150, 58) + F.label(cx0 + 75, cy0 + 76, 'CL-401', 'dry coolers ' + F.fvs(sys.design.data.Qtot, 1) + ' MW'));
    g += ln('coolRet', [[606, hdrY + 19], [606, 656], [cx0 + 150, 656]], 'cool') + tagS('coolRet', 548, 656);
    g += ln('coolSup', [[cx0 + 150, 640], [594, 640], [594, hdrY + 19]], 'cool') + tagS('coolSup', 524, 640);
    g += T(506, 676, 'also cools E-102, CP-201', { s: 8.5, c: 'var(--dw-ink2)', it: true });
    /* ---------- hydrogen treatment (top right) ---------- */
    const hy = 250;
    g += ln('wetH2', [[v1.x + 30, v1.y], [v1.x + 30, hy], [941, hy]]) + tagS('wetH2', 870, hy) + callout('wetH2', 806, hy - 42);
    g += F.eqg('E-102', S.hx(950, hy, 19) + F.label(950, hy - 32, 'E-102', 'gas cooler'));
    g += ln('cond', [[950, hy + 19], [950, 318]], 'water', { id: null }) + F.offpage(918, 328, 'to TK-101', 'left', 'water');
    g += ln('coolH2', [[969, hy], [1012, hy]]) + tagS('coolH2', 990, hy);
    g += F.eqg('R-101', S.reactor(1012, hy - 46, 38, 92) + F.label(1031, hy - 62, 'R-101', 'deoxo'));
    g += ln('deoxo', [[1050, hy], [1082, hy]]) + tagS('deoxo', 1066, hy + 24);
    g += F.eqg('D-101', S.dryer(1082, hy - 46, 76, 92) + F.label(1120, hy - 62, 'D-101', 'TSA dryer'));
    g += ln('dry', [[1158, hy], [1194, hy]]) + tagS('dry', 1176, hy + 24);
    g += F.instr(1176, hy - 44, 'AT', '102', 1176, hy);
    g += F.eqg('CP-201', S.compressor(1220, hy, 26) + F.label(1220, hy + 44, 'CP-201', sys.compTrain.N + '-stage · ' + fv(sys.compTrain.P, 0) + ' kW'));
    g += ln('comp', [[1246, hy], [1280, hy]]) + tagS('comp', 1263, hy - 22);
    g += F.eqg('ST-201', S.storage(1280, hy - 38, 130, 76) + F.label(1345, hy - 70, 'ST-201', F.fvs(sys.E['ST-201'].props[1][1] / 1000, 1) + ' t usable · ' + b.storePmin + '–' + b.storeP + ' bar'));
    g += F.instr(1426, hy + 60, 'PT', '201', 1410, hy + 26);
    // hydrogen vent
    g += F.eqg('VS-401', S.vent(1452, 118, 72) + F.label(1452, 104, 'VS-401', '', { s: 10 }));
    g += F.line([[1410, hy - 6], [1452, hy - 6], [1452, 190]], 'h2', { dash: '3 3', w: 1.4 }) + T(1418, hy - 11, 'PSV', { s: 8.5, c: 'var(--dw-ink2)' });
    /* ---------- oxygen ---------- */
    if (!isSOEC) {
      g += ln('o2', [[v2.x + 30, v2.y], [v2.x + 30, 395], [1004, 395]]) + tagS('o2', 930, 395) + F.instr(968, 432, 'AT', '101', 968, 395);
      g += F.eqg('VS-402', S.vent(1010, 312, 96) + F.label(1024, 330, 'VS-402', 'O₂ vent', { a: 'start', s: 11 }));
    } else g += F.eqg('VS-402', S.vent(1010, 312, 96) + F.label(1024, 330, 'VS-402', 'air + O₂ vent', { a: 'start', s: 11 }));
    /* ---------- end use ---------- */
    const eu = sys.endUse;
    if (eu.type === 'nh3') {
      g += ln('deliver', [[1345, hy + 38], [1345, 440], [1318, 440]]) + tagS('deliver', 1345, 392) + callout('deliver', 1352, 330);
      g += F.eqg('AS-301', S.column(1128, 440, 42, 150) + F.label(1149, 612, 'AS-301', 'ASU ' + fv(eu.syn.mN2 * 24, 0) + ' t/d N₂'));
      g += ln('air', [[1080, 575], [1128, 575]]) + tagS('air', 1098, 575) + T(1060, 594, 'air', { s: 9, c: 'var(--dw-ink2)' });
      g += ln('n2', [[1170, 470], [1258, 470]]) + tagS('n2', 1214, 470);
      g += F.eqg('NH-301', S.reactor(1258, 420, 60, 160) + F.label(1288, 604, 'NH-301', 'NH₃ loop ' + fv(eu.mNH3 * 24, 0) + ' t/d'));
      g += ln('nh3', [[1318, 540], [1392, 540]]) + tagS('nh3', 1356, 540);
      g += F.eqg('TK-301', S.tank(1392, 470, 84, 120, 'nh3') + F.label(1434, 612, 'TK-301', 'NH₃ ' + fv(eu.tankT, 0) + ' t, −33 °C'));
    } else if (eu.type === 'hrs') {
      g += ln('deliver', [[1345, hy + 38], [1345, 470], [1330, 470]]) + tagS('deliver', 1345, 410) + callout('deliver', 1352, 330);
      g += F.eqg('HR-301', S.dispenser(1282, 440, 48, 80) + F.label(1306, 544, 'HR-301', '70 MPa dispensers') + S.compressor(1350, 470, 12));
      g += T(1306, 572, fv(b.demand, 0) + ' kg/d · peak ' + fv(eu.hrs.peak, 0) + ' kg/h', { a: 'middle', s: 10, c: 'var(--dw-ink2)' });
    } else {
      g += ln('deliver', [[1345, hy + 38], [1345, 450], [1482, 450]]) + tagS('deliver', 1345, 410) + callout('deliver', 1352, 330);
      if (eu.pipe) g += F.eqg('PL-301', S.valve(1430, 450, 8) + F.label(1440, 478, 'PL-301', 'DN' + eu.pipe.DN + ' · ' + fv(eu.pipe.L, 1) + ' km → customer'));
      if (st.trailer) { g += ln('trailer', [[1345, 450], [1345, 490], [1300, 490], [1300, 505]]) + tagS('trailer', 1322, 490); g += F.eqg('TL-301', '<rect x="1250" y="505" width="100" height="30" rx="4" fill="var(--dw-fill)" stroke="var(--dw-ink)" stroke-width="1.5"/>' + S.storage(1258, 509, 80, 22) + '<circle cx="1270" cy="540" r="5" fill="var(--dw-ink)"/><circle cx="1330" cy="540" r="5" fill="var(--dw-ink)"/>' + F.label(1300, 562, 'TL-301', 'trailer bay 500 bar')); }
    }
    /* ---------- stream table ---------- */
    const ty = 712, rows = sys.streams.map(s => {
      const other = Object.keys(s.comp).filter(k => ['H2', 'O2', 'H2O'].indexOf(k) < 0 && s.comp[k] > 0.5).map(k => ({ KOH: 'KOH', TDS: 'salts', N2: 'N₂', NH3: 'NH₃', glycol: 'glycol', other: 'Ar' }[k] || k) + ' ' + fv(s.comp[k], 0)).join(', ');
      const r = [s.no, s.name, s.phase, s.T, s.p, s.m, s.comp.H2 || 0, s.comp.O2 || 0, s.comp.H2O || 0, other]; r._id = 'S' + s.no; r._c = F.col(s.type); return r;
    });
    const cols = [{ t: 'No.', w: 30, d: 0 }, { t: 'Stream', w: 196, max: 40 }, { t: 'Phase', w: 38 }, { t: 'T °C', w: 44, a: 'end', d: 0 }, { t: 'p bar', w: 46, a: 'end', d: 1 }, { t: 'Total kg/h', w: 76, a: 'end', d: 0 }, { t: 'H₂', w: 60, a: 'end', d: 0 }, { t: 'O₂', w: 60, a: 'end', d: 0 }, { t: 'H₂O', w: 68, a: 'end', d: 0 }, { t: 'Other', w: 98, max: 18 }];
    const half = Math.ceil(rows.length / 2);
    g += T(30, ty - 6, 'STREAM TABLE – design point (rated load, BoL)', { s: 10, w: 700 });
    g += F.table(30, ty, cols, rows.slice(0, half), { rh: 16, s: 9 });
    if (rows.length > half) g += F.table(752, ty, cols, rows.slice(half), { rh: 16, s: 9 });
    /* ---------- legend and notes ---------- */
    const ly = sh.tb.y + 8;
    g += F.legend(30, ly - 2, ['h2', 'o2', 'water', 'lye', 'cool', 'elec', 'dc'].concat(eu.type === 'nh3' ? ['n2', 'nh3'] : []), { s: 9, maxW: 800 });
    g += F.note(30, ly + 30, ['All flows are plant totals at rated DC power; equipment marked × is repeated per module or train.', 'Separators sized by Souders–Brown (DM 10.1); gas water content by CM 8.3; deoxo ΔT by CM 8.4.', 'Compression by DM 12.1/12.2; storage by DM 13.1/13.2; streams recalculate when the design basis changes.', 'Instrument tags per ISA 5.1: AT = analyser (H₂ in O₂, O₂ in H₂), PT = pressure, TIC = temperature control.'], { title: 'NOTES' });
    return F.wrap(sh, g, { title: 'PFD-001 Process flow diagram' });
  };

  /* =================================================================
     SLD-001 ELECTRICAL SINGLE-LINE DIAGRAM
     ================================================================= */
  F.sld = function (sys) {
    const b = sys.basis, el = sys.elec;
    const sh = F.sheet({ w: 1500, h: 1060, title: 'Electrical single-line diagram', dwg: 'SLD-001', project: b.name, site: b.siteName || '', doc: b, basis: 'IEC 60617 symbols. Ratings from DM 5.1–5.4 and DM 3.4.' });
    let g = '';
    const busY = 330, x0 = 60, x1 = 1440;
    const G2 = 'var(--dw-ink2)';
    g += '<rect x="' + x0 + '" y="' + (busY - 4) + '" width="' + (x1 - x0) + '" height="8" fill="var(--st-elec)"/>';
    g += T(x0, busY - 12, 'MV BUSBAR ' + el.kV + ' kV, 50 Hz', { s: 12, w: 700 });
    // ---- source feeders above the bus
    const top = [];
    if (el.grid) top.push({ tag: 'GR-001', draw: x => S.gridTower(x, 92, 70), top: 162, lines: ['Utility ' + el.kV + ' kV', 'import ≤ ' + F.fvs(el.grid.MW) + ' MW', 'S″k ' + fv(el.grid.Ssc) + ' MVA', 'I″k ' + fv(el.grid.Isc, 2) + ' kA (DM 5.4)', 'CI ' + fv(el.grid.CI) + ' g/kWh'], meter: true });
    if (el.pv) top.push({ tag: 'PV-001', ppa: el.ppa, draw: x => S.pv(x - 44, 90, 88, 50) + S.converter(x, 176, 30, 'inv') + S.transformer(x, 226, 11, true), top: 244, lines: [fv(el.pv.MWp) + ' MWp / ' + fv(el.pv.MWac) + ' MWac', el.pv.inverters + ' × ' + el.pv.Sinv + ' MVA inverters', el.pv.feeders + ' collector feeders', fv(el.pv.modules) + ' modules (DM 3.4)'] });
    if (el.wind) top.push({ tag: 'WT-001', ppa: el.ppa, draw: x => S.wind(x, 80, 84) + S.converter(x, 186, 30, 'inv') + S.transformer(x, 232, 11, true), top: 250, lines: [el.wind.n + ' × ' + F.fvs(el.wind.unit, 1) + ' MW turbines', 'full-scale converters', el.kV + ' kV collector'] });
    if (el.bess) top.push({ tag: 'BT-001', draw: x => S.battery(x - 34, 100, 68, 40) + S.converter(x, 176, 30, 'inv') + S.transformer(x, 226, 11, true), top: 244, lines: [F.fvs(el.bess.MW) + ' MW / ' + F.fvs(el.bess.MWh) + ' MWh', 'PCS ' + F.fvs(el.bess.Spcs, 1) + ' MVA', el.islanded ? 'grid-forming, black start' : 'grid-following'] });
    const sp = 300, sx0 = 420;
    top.forEach((t, i) => {
      const x = sx0 + i * sp;
      g += F.eqg(t.tag, t.draw(x) + T(x, 70, t.tag, { a: 'middle', s: 12.5, w: 700 }));
      g += F.line([[x, t.top], [x, busY - 4]], 'elec', { arrow: false, dash: t.ppa ? '6 4' : '' }) + S.breaker(x, 296, 11) + T(x + 10, 299, 'CB', { s: 8.5, c: G2 });
      if (t.ppa) g += T(x + 26, 282, 'PPA – off-site, wheeled via grid', { s: 9, c: G2, it: true });
      if (t.meter) g += F.Cir(x, 268, 9, { f: 'var(--dw-sheet)', w: 1.3 }) + T(x + 13, 272, 'M', { s: 8.5, c: G2 });
      t.lines.forEach((ln, k) => { g += T(x + 26, 150 + k * 13, ln, { s: 9.5, c: G2 }); });
    });
    // ---- auxiliary transformer
    const auxX = 110;
    let a = F.line([[auxX, busY + 4], [auxX, 380]], 'elec', { arrow: false }) + S.breaker(auxX, 360, 11) + S.transformer(auxX, 408, 14, true) + F.line([[auxX, 436], [auxX, 520]], 'elec', { arrow: false }) + '<rect x="' + (auxX - 60) + '" y="518" width="150" height="5" fill="var(--st-elec)"/>';
    a += T(auxX + 22, 404, 'TX-401', { s: 11.5, w: 700 }) + T(auxX + 22, 418, F.fvs(el.aux.S) + ' MVA', { s: 9.5, c: G2 }) + T(auxX + 22, 431, el.kV + ' kV / 0.4 kV', { s: 9.5, c: G2 });
    [['Compressors CP-201', el.aux.comp_kW], ['Circulation pumps', el.aux.pump_kW], ['Water plant WT-101', el.aux.water_kW], ['Dry-cooler fans', el.aux.fans_kW]].forEach((q, i) => { a += F.line([[auxX - 45 + i * 38, 523], [auxX - 45 + i * 38, 552]], 'elec', { w: 1.3 }); a += T(auxX - 60, 590 + i * 13, q[0] + ' – ' + fv(q[1], 0) + ' kW', { s: 9.2, c: G2 }); });
    a += T(auxX - 60, 572, '0.4 kV auxiliary switchboard', { s: 10, w: 700 });
    g += F.eqg('TX-401', a);
    // ---- harmonic filter / STATCOM
    if (el.filter > 0) { const fx = 270; g += F.eqg('FC-101', F.line([[fx, busY + 4], [fx, 380]], 'elec', { arrow: false }) + S.breaker(fx, 360, 11) + F.P('M' + (fx - 10) + ',392 h20 M' + (fx - 10) + ',398 h20', { w: 1.6 }) + F.P('M' + fx + ',398 v14 q8,4 0,8 q-8,4 0,8 q8,4 0,8 v10', { w: 1.3 }) + S.ground(fx, 446) + T(fx + 14, 404, 'FC-101', { s: 11.5, w: 700 }) + T(fx + 14, 418, F.fvs(el.filter, 1) + ' Mvar', { s: 9.5, c: G2 }) + T(fx + 14, 431, 'h = 11, 13', { s: 9.5, c: G2 })); }
    // ---- electrolyser module feeders
    const m = el.modules, nShow = Math.min(4, b.modules), fx0 = 470, fsp = 190;
    for (let i = 0; i < nShow; i++) {
      const last = i === nShow - 1 && b.modules > nShow; const x = fx0 + i * fsp + (last ? 60 : 0);
      let q = F.line([[x, busY + 4], [x, 380]], 'elec', { arrow: false }) + S.breaker(x, 360, 11);
      q += S.transformer(x, 408, 14, true) + F.line([[x, 436], [x, 470]], 'elec', { arrow: false });
      q += S.converter(x, 490, 38) + F.line([[x, 509], [x, 560]], 'dc', { arrow: false });
      q += S.electrolyser(x - 55, 560, 110, 70);
      const tagN = 'EL-1' + String(last ? b.modules : i + 1).padStart(2, '0');
      q += T(x, 652, tagN, { a: 'middle', s: 11.5, w: 700 }) + T(x, 666, sys.cellStack.stacksPerMod + ' stack' + (sys.cellStack.stacksPerMod > 1 ? 's' : '') + ' · ' + F.fvs(m.Pdc / 1000, 2) + ' MW DC', { a: 'middle', s: 9.5, c: G2 });
      g += F.eqg(i ? 'EL-101' : 'RC-101', q);
      if (last) g += T(x - (fsp + 60) / 2, 500, '· · ·', { a: 'middle', s: 22, w: 700, c: G2 });
    }
    // ---- module data block (right)
    const dx = 1150; let dy = 372;
    g += T(dx, dy, '× ' + b.modules + ' identical module feeders', { s: 13, w: 700 }); dy += 24;
    const blk = (title, lines) => { g += T(dx, dy, title, { s: 11, w: 700 }); dy += 14; lines.forEach(l => { g += T(dx, dy, l, { s: 9.6, c: G2 }); dy += 13; }); dy += 8; };
    blk('TR-101… rectifier transformer', [F.fvs(m.ST) + ' MVA, u_k 8 %, ' + el.kV + ' kV / ' + m.VLL + ' V', 'I″k secondary ' + fv(m.IscT, 0) + ' kA (IEC 60909, c = 1.1)']);
    blk('RC-101… ' + m.type, [fv(m.Vdc, 0) + ' V DC · ' + fv(m.Idc / 1000, 2) + ' kA · ' + F.fvs(m.Pdc / 1000, 2) + ' MW', m.alpha ? 'α ' + fv(m.alpha, 1) + '° · cos φ ' + fv(m.cosphi, 3) + ' (DM 5.1)' : 'cos φ ' + fv(m.cosphi, 2) + ' (PWM)']);
    blk('DC busbar', [fv(m.busbar.Areq, 0) + ' mm² Cu at 1.6 A/mm²', 'loss ' + fv(m.busbar.P, 1) + ' kW, ΔV ' + fv(m.busbar.dV, 2) + ' V (DM 5.3)']);
    blk('Plant', ['P_AC ' + F.fvs(m.Pac * b.modules / 1000, 1) + ' MW at rated load', 'installed transformers ' + F.fvs(el.totalMVA, 1) + ' MVA']);
    // ---- summary table and notes
    const rows = [['Electrolyser modules', b.modules + ' × ' + b.moduleMW + ' MW', m.type], ['Rectifier transformer', F.fvs(m.ST) + ' MVA', el.kV + ' kV / ' + m.VLL + ' V, u_k 8 %'], ['DC output per module', fv(m.Vdc, 0) + ' V / ' + fv(m.Idc / 1000, 2) + ' kA', F.fvs(m.Pdc / 1000, 2) + ' MW'], ['Power factor', fv(m.cosphi, 3), m.alpha ? 'firing angle ' + fv(m.alpha, 1) + '°' : 'PWM active front-end'],
      ['Reactive compensation', el.filter > 0 ? F.fvs(el.filter, 1) + ' Mvar' : 'not required', 'DM 5.2'], ['Auxiliary transformer', F.fvs(el.aux.S) + ' MVA', F.fvs(el.aux.MW, 2) + ' MW load'], ['Total installed transformers', F.fvs(el.totalMVA, 1) + ' MVA', el.islanded ? 'islanded microgrid' : 'grid-connected']];
    if (el.grid) rows.push(['Grid fault level', fv(el.grid.Ssc) + ' MVA', 'I″k ' + fv(el.grid.Isc, 2) + ' kA']);
    g += T(40, 720, 'ELECTRICAL DATA', { s: 10.5, w: 700 });
    g += F.table(40, 728, [{ t: 'Item', w: 220 }, { t: 'Rating', w: 170 }, { t: 'Remarks', w: 230 }], rows, { rh: 18, s: 9.5 });
    g += F.note(700, 732, ['Circuit breakers, transformers and converters drawn with IEC 60617 symbols.', 'Four representative electrolyser feeders are drawn; the remaining feeders are identical.', 'Transformer rating S_T = P_DC /(η cos φ)·(1 + m), m = 8 % (DM 5.2), rounded to IEC standard sizes.', 'Fault currents to IEC 60909 (c = 1.1, source impedance); DC busbars by DM 5.3 at 1.6 A/mm² over a 20 m loop.', '12-pulse thyristor rectifiers need filters tuned to h = 11, 13 (DM 5.2); harmonics at the PCC checked against IEEE 519-2022.'], {});
    return F.wrap(sh, g, { title: 'SLD-001 Electrical single-line diagram' });
  };
})(typeof window !== 'undefined' ? window : globalThis);

;
/* Hasim – Green Hydrogen Engineering Suite. © 2026 Prof. Hani Muhsen. All rights reserved. */
/* =====================================================================
   Hasim – figures-more.js : Sankey energy and mass balances, cell cross
   section, stack & module drawing, water-treatment train, compression
   train, plot plan with safety distances and the live power-flow view.
   Owner and developer: Prof. Hani Muhsen.
   ===================================================================== */
(function (root) {
  'use strict';
  const H2 = root.H2, F = root.H2F, S = F.sym, T = F.T, L = F.L, fv = F.fv, fvs = F.fvs;
  const G2 = 'var(--dw-ink2)';
  const pct = v => (isFinite(v) ? (100 * v).toFixed(1) + ' %' : '–');

  /* =================================================================
     SNK-001 / SNK-002 SANKEY DIAGRAMS
     ================================================================= */
  F.sankeyDwg = function (sys, kind) {
    const b = sys.basis, mass = kind === 'mass';
    const data = mass ? sys.sankeyM : sys.sankeyE;
    const sh = F.sheet({ w: 1500, h: 1060, title: mass ? 'Annual water and mass balance' : 'Annual energy balance', dwg: mass ? 'SNK-002' : 'SNK-001', project: b.name, site: b.siteName || '', doc: b, basis: 'From the 8760-hour simulation of the design basis (' + data.unit + ').' });
    const links = data.links.map(l => Object.assign({}, l));
    const lay = F.sankey(links, { x: 230, y: 110, w: 740, h: 760 }, { nodeW: 18, pad: 34 });
    let g = T(40, 60, mass ? 'Water and mass flows, ' + data.unit : 'Energy flows, ' + data.unit, { s: 16, w: 700 });
    g += T(40, 78, mass ? 'Link width proportional to mass flow. Raw water → demineralised water → electrolysis → hydrogen and oxygen' + (b.product === 'NH3' ? ' → ammonia.' : '.') : 'Link width proportional to energy. Renewable and grid electricity → losses → hydrogen chemical energy (LHV)' + (b.product === 'NH3' ? ' → ammonia.' : '.'), { s: 10.5, c: G2 });
    const totIn = lay.nodes.filter(n => n.in === 0).reduce((a, n) => a + n.out, 0);
    lay.links.forEach(l => { g += '<path d="' + l.path + '" fill="none" stroke="' + F.col(l.type) + '" stroke-width="' + Math.max(1.2, l.w).toFixed(1) + '" stroke-opacity="0.42" class="sk-link"><title>' + F.esc(l.s + ' → ' + l.t + ': ' + fv(l.v, 2) + ' ' + data.unit) + '</title></path>'; });
    lay.nodes.forEach(n => {
      const ty = (n.src[0] || n.dst[0]).type; const v = Math.max(n.in, n.out);
      g += '<rect x="' + n.x + '" y="' + n.y.toFixed(1) + '" width="' + lay.nodeW + '" height="' + n.h.toFixed(1) + '" fill="' + F.col(n.out === 0 ? ty : (n.dst[0] || n.src[0]).type) + '" stroke="var(--dw-ink)" stroke-width="0.6"/>';
      const right = n.out === 0, lx = right ? n.x + lay.nodeW + 8 : n.x - 8, ly = n.y + n.h / 2;
      g += T(lx, ly - 2, n.name, { a: right ? null : 'end', s: 12, w: 700, halo: true }) + T(lx, ly + 12, fv(v, v < 10 ? 2 : 1) + ' ' + data.unit + ' · ' + pct(v / totIn), { a: right ? null : 'end', s: 10, c: G2, halo: true });
    });
    // flow table
    const rows = links.map(l => [l.s + ' → ' + l.t, l.v, pct(l.v / totIn)]);
    g += T(1150, 110, 'FLOW TABLE', { s: 10.5, w: 700 });
    g += F.table(1150, 118, [{ t: 'Flow', w: 222, max: 44 }, { t: data.unit, w: 60, a: 'end', d: 2 }, { t: 'share', w: 50, a: 'end' }], rows, { rh: 17, s: 8.6 });
    // key figures
    const A = sys.annual.kpi; let kf;
    if (!mass) kf = [['Renewable + grid input', fv(A.E_pv_GWh + A.E_wind_GWh + A.E_grid_GWh, 1) + ' GWh/a'], ['Hydrogen after gas processing (LHV)', fv(A.E_H2_LHV_GWh, 1) + ' GWh/a'], ['Supply-to-H₂ efficiency (LHV)', pct(A.E_H2_LHV_GWh / (A.E_pv_GWh + A.E_wind_GWh + A.E_grid_GWh))], ['Electrolyser system efficiency (LHV)', pct(A.E_H2_LHV_GWh / A.E_ely_GWh)], ['Stack efficiency (LHV)', pct(A.E_H2_stack_LHV_GWh / A.E_dc_GWh)], ['Curtailed / sold share', pct(A.curt_share) + ' / ' + pct(A.export_share || 0)], ['Balance closure', fv(Math.abs(sys.sankeyE.closure), 4) + ' GWh']];
    else kf = [['Raw water', fv(A.V_raw_m3a, 0) + ' m³/a'], ['Demineralised water', fv(A.V_DI_m3a, 0) + ' m³/a'], ['Specific raw water', A.H2_t > 0 ? fv(A.V_raw_m3a / A.H2_t, 1) + ' m³/t H₂' : '–'], ['Hydrogen', fv(A.H2_t, 0) + ' t/a'], ['Oxygen by-product', fv(A.H2_stack_t * H2.C.w_O2, 0) + ' t/a']].concat(b.product === 'NH3' ? [['Ammonia', fv(A.H2_t * H2.NH3.loop / H2.NH3.h2, 0) + ' t/a']] : []);
    const ky = 118 + 17 * (rows.length + 1) + 30;
    g += T(1150, ky, 'KEY FIGURES', { s: 10.5, w: 700 }) + F.table(1150, ky + 8, [{ t: 'Quantity', w: 210 }, { t: 'Value', w: 122, a: 'end' }], kf, { rh: 17, s: 9 });
    g += F.legend(40, 920, mass ? ['water', 'h2', 'o2', 'loss'].concat(b.product === 'NH3' ? ['n2'] : []) : ['elec', 'aux', 'loss', 'heat', 'h2'].concat(b.product === 'NH3' ? ['nh3'] : []), { s: 9.5, maxW: 780 });
    g += F.note(40, 950, mass ? ['Stoichiometric water 8.937 kg per kg H₂; oxygen 7.937 kg per kg H₂ (CM 4.2, 8.1).', 'Raw water from DM 6.1 with the overall two-pass RO recovery (DM 6.2); losses include vapour, blowdown and EDI reject.', 'Ammonia by 0.178 kg H₂ and 0.822 kg N₂ per kg NH₃ with 97 % loop yield (DM 15.2); gas-processing losses = deoxo H₂ consumption and dryer purge.'] :
      ['Energy streams accumulated hour by hour in the 8760-h dispatch (DM Fig. 4.2); closure < 0.01 GWh.', 'Conversion losses = rectifier and transformer losses; electrolyser BoP = fixed and load-proportional loads (CM 6.4).', 'Stack heat = DC energy − hydrogen HHV (to the coolant, CM 3.10); HHV − LHV is the latent heat of the product water; SOEC: heat supply for steam and endothermic operation.'], {});
    return F.wrap(sh, g, { title: (mass ? 'SNK-002' : 'SNK-001') + ' Sankey' });
  };

  /* =================================================================
     CEL-001 CELL CROSS-SECTION, VOLTAGE BREAKDOWN, POLARISATION
     ================================================================= */
  const LAYERS = {
    PEM: [['Bipolar plate (Ti)', 20, 'bp'], ['PTL, Ti felt', 26, 'ptl'], ['Anode CL IrO₂', 9, 'cla'], ['Membrane PFSA', 16, 'mem'], ['Cathode CL Pt/C', 9, 'clc'], ['GDL, carbon', 26, 'ptl'], ['Bipolar plate', 20, 'bp']],
    AEL: [['Bipolar plate (Ni)', 20, 'bp'], ['Anode Ni / NiFe', 14, 'cla'], ['KOH gap', 26, 'ely'], ['Diaphragm Zirfon', 10, 'mem'], ['KOH gap', 26, 'ely'], ['Cathode Raney-Ni', 14, 'clc'], ['Bipolar plate', 20, 'bp']],
    AEM: [['Bipolar plate', 20, 'bp'], ['PTL, Ni foam', 24, 'ptl'], ['Anode CL NiFe', 9, 'cla'], ['Anion-exchange membrane', 16, 'mem'], ['Cathode CL Ni', 9, 'clc'], ['GDL, carbon', 24, 'ptl'], ['Bipolar plate', 20, 'bp']],
    SOEC: [['Interconnect', 20, 'bp'], ['Air electrode LSCF', 20, 'cla'], ['Electrolyte YSZ', 14, 'mem'], ['Fuel electrode Ni-YSZ', 32, 'clc'], ['Interconnect', 20, 'bp']]
  };
  const REACT = {
    PEM: ['Anode: 2 H₂O → O₂ + 4 H⁺ + 4 e⁻', 'Cathode: 4 H⁺ + 4 e⁻ → 2 H₂', 'H⁺', 1],
    AEL: ['Anode: 4 OH⁻ → O₂ + 2 H₂O + 4 e⁻', 'Cathode: 4 H₂O + 4 e⁻ → 2 H₂ + 4 OH⁻', 'OH⁻', -1],
    AEM: ['Anode: 4 OH⁻ → O₂ + 2 H₂O + 4 e⁻', 'Cathode: 4 H₂O + 4 e⁻ → 2 H₂ + 4 OH⁻', 'OH⁻', -1],
    SOEC: ['Anode: 2 O²⁻ → O₂ + 4 e⁻', 'Cathode: 2 H₂O + 4 e⁻ → 2 H₂ + 2 O²⁻', 'O²⁻', -1]
  };
  const LFILL = { bp: 'var(--dw-fill2)', ptl: 'url(#dots)', cla: 'var(--st-o2)', clc: 'var(--st-h2)', mem: 'var(--st-lye)', ely: 'var(--st-water)' };
  F.cellDwg = function (sys) {
    const b = sys.basis, cs = sys.cellStack, c = cs.cell, tech = cs.tech;
    const sh = F.sheet({ w: 1500, h: 1060, title: 'Cell cross-section and voltage breakdown', dwg: 'CEL-001', project: b.name, site: b.siteName || '', doc: b, basis: 'Cell model CM 4.4 at rated current density, operating T and p.' });
    let g = T(40, 60, 'EL-101 – ' + cs.techName + ' cell at ' + fv(cs.j, 2) + ' A/cm², ' + cs.T + ' °C, p(H₂) ' + cs.pH2 + ' bar, p(O₂) ' + cs.pO2 + ' bar', { s: 15, w: 700 });
    // ---------- cross-section ----------
    const lay = LAYERS[tech] || LAYERS.PEM; const scale = 3.0; const totW = lay.reduce((a, l) => a + l[1], 0) * scale;
    const x0 = 370 - totW / 2, y0 = 190, h = 300;
    let x = x0; const bounds = [];
    lay.forEach((l, i) => {
      const w = l[1] * scale; const f = LFILL[l[2]] || 'var(--dw-fill)'; const op = ['cla', 'clc', 'mem', 'ely'].indexOf(l[2]) >= 0 ? 0.28 : 1;
      g += '<rect x="' + x.toFixed(1) + '" y="' + y0 + '" width="' + w.toFixed(1) + '" height="' + h + '" fill="' + f + '" fill-opacity="' + op + '" stroke="var(--dw-ink)" stroke-width="1.2"/>';
      if (l[2] === 'bp') for (let k = 0; k < 6; k++) g += '<rect x="' + (i === 0 ? x + w - 9 : x).toFixed(1) + '" y="' + (y0 + 26 + k * 46) + '" width="9" height="22" fill="var(--dw-sheet)" stroke="var(--dw-ink)" stroke-width="0.8"/>';
      bounds.push([x, w, l[0]]); x += w;
    });
    // balloons (part numbers) and parts list
    bounds.forEach((bd, i) => { const cx = bd[0] + bd[1] / 2; g += F.Cir(cx, y0 + h + 18, 9, { f: 'var(--dw-sheet)', w: 1.1 }) + T(cx, y0 + h + 22, String(i + 1), { a: 'middle', s: 9.5, w: 700 }) + L(cx, y0 + h, cx, y0 + h + 9, { c: G2, w: 0.8 }); });
    const r = REACT[tech] || REACT.PEM;
    const memB = bounds.find(bd => /Membrane|Diaphragm|Electrolyte YSZ|Anion/.test(bd[2]));
    const mx = memB ? memB[0] + memB[1] / 2 : x0 + totW / 2;
    const anodeX = x0 + totW * 0.2, cathX = x0 + totW * 0.8;
    // ion transport arrows
    for (let k = 0; k < 3; k++) { const yy = y0 + 70 + k * 80; const xa = mx - 52, xb = mx + 52; g += F.line(r[3] > 0 ? [[xa, yy], [xb, yy]] : [[xb, yy], [xa, yy]], 'lye', { w: 2.2 }) + T(mx, yy - 7, r[2], { a: 'middle', s: 11, w: 700, c: 'var(--st-lye)', halo: true }); }
    // outlets (top) and inlet (bottom, from the side)
    g += F.line([[anodeX, y0 + 24], [anodeX, y0 - 34]], 'o2') + T(anodeX + 6, y0 - 26, 'O₂', { s: 10.5, w: 700, c: 'var(--st-o2)' });
    g += F.line([[cathX, y0 + 24], [cathX, y0 - 34]], 'h2') + T(cathX + 6, y0 - 26, 'H₂', { s: 10.5, w: 700, c: 'var(--st-h2)' });
    const inX = tech === 'PEM' ? anodeX : cathX, inT = tech === 'PEM' ? 'water' : tech === 'SOEC' ? 'water' : 'lye';
    g += F.line([[inX + (tech === 'PEM' ? -1 : 1) * (totW * 0.2 + 34), y0 + h - 18], [inX, y0 + h - 18]], inT) + T(inX + (tech === 'PEM' ? -1 : 1) * (totW * 0.2 + 38), y0 + h - 14, tech === 'SOEC' ? 'steam in' : tech === 'PEM' ? 'H₂O in' : (tech === 'AEL' ? 'KOH/H₂O in' : 'H₂O in'), { a: tech === 'PEM' ? 'end' : null, s: 10, w: 700, c: F.col(inT) });
    g += T(x0, y0 - 8, 'ANODE (+)', { s: 10, w: 700, c: 'var(--st-o2)' }) + T(x0 + totW, y0 - 8, 'CATHODE (−)', { a: 'end', s: 10, w: 700, c: 'var(--st-h2)' });
    // external circuit: electrons leave the anode and travel through the DC source to the cathode
    const wy = 112;
    g += F.P('M' + (x0 + 10) + ',' + y0 + ' V' + wy + ' H' + (mx - 24) + ' M' + (mx + 24) + ',' + wy + ' H' + (x0 + totW - 10) + ' V' + y0, { w: 1.6, c: 'var(--st-dc)' });
    g += F.Cir(mx, wy, 20, { f: 'var(--dw-sheet)', c: 'var(--st-dc)', w: 1.6 }) + T(mx, wy + 4, 'DC', { a: 'middle', s: 10, w: 700, c: 'var(--st-dc)' });
    g += F.line([[mx - 110, wy], [mx - 60, wy]], 'dc', { w: 1.6 }) + T(mx - 85, wy - 8, 'e⁻', { a: 'middle', s: 11, w: 700, c: 'var(--st-dc)' });
    g += F.line([[mx + 60, wy], [mx + 110, wy]], 'dc', { w: 1.6 }) + T(mx + 85, wy - 8, 'e⁻', { a: 'middle', s: 11, w: 700, c: 'var(--st-dc)' });
    g += T(mx, wy - 30, fv(c.Ecell, 3) + ' V · ' + fv(cs.j, 2) + ' A/cm² · ' + fv(cs.j * cs.Acell / 1000, 2) + ' kA per cell', { a: 'middle', s: 11, w: 700 });
    // parts list and reactions
    const ply = y0 + h + 50;
    g += T(40, ply, 'LAYERS (schematic, not to scale)', { s: 9.5, w: 700 });
    bounds.forEach((bd, i) => { const col = i < 4 ? 0 : 1, row = i < 4 ? i : i - 4; g += T(40 + col * 300, ply + 16 + row * 14, (i + 1) + '  ' + bd[2], { s: 9.5 }); });
    const ry = ply + 16 + 4 * 14 + 10;
    g += '<rect x="40" y="' + (ry - 12) + '" width="620" height="44" fill="var(--dw-fill)" stroke="var(--dw-thin)" stroke-width="0.8"/>';
    g += T(50, ry + 4, r[0], { s: 10.5, w: 600, c: 'var(--st-o2)' }) + T(50, ry + 22, r[1], { s: 10.5, w: 600, c: 'var(--st-h2)' }) + T(650, ry + 13, 'ion: ' + r[2] + ' (' + (r[3] > 0 ? 'anode → cathode' : 'cathode → anode') + ')', { a: 'end', s: 10, c: 'var(--st-lye)', w: 700 });
    // ---------- voltage staircase ----------
    const vx = 800, vy = 120, vh = 420, vmax = Math.ceil((Math.max(c.Ecell, c.Etn) + 0.1) * 10) / 10, sy = v => vy + vh - v / vmax * vh;
    g += T(vx, vy - 26, 'Voltage breakdown (CM 4.4)', { s: 12.5, w: 700 });
    for (let v = 0; v <= vmax + 1e-9; v += 0.2) g += L(vx, sy(v).toFixed(1), vx + 600, sy(v).toFixed(1), { c: 'var(--dw-grid)', w: 0.8 }) + T(vx - 6, sy(v) + 4, v.toFixed(1), { a: 'end', s: 9.5, c: G2 });
    g += T(vx - 34, vy + vh / 2, 'Cell voltage (V)', { a: 'middle', s: 10, c: G2, rot: -90 });
    const segs = [['E_rev (T, p)', c.Erev, 'var(--dw-fill2)', 'CM 3.5/3.6'], ['η_act anode', c.eta_a, 'var(--st-o2)', 'CM 4.5'], ['η_act cathode', c.eta_c, 'var(--st-h2)', 'CM 4.5'], ['η_ohm = j·ASR', c.eta_ohm, 'var(--st-lye)', 'CM 4.7'], ['η_conc', c.eta_conc, 'var(--st-heat)', 'CM 4.10']];
    let acc = 0; const bx = vx + 70, bw = 120;
    segs.forEach((sgm, i) => {
      const y1 = sy(acc + sgm[1]), y2 = sy(acc); const hh = Math.max(0.6, y2 - y1);
      g += '<rect x="' + bx + '" y="' + y1.toFixed(1) + '" width="' + bw + '" height="' + hh.toFixed(1) + '" fill="' + sgm[2] + '" fill-opacity="' + (i ? 0.75 : 1) + '" stroke="var(--dw-ink)" stroke-width="0.9"/>';
      const ly = (y1 + y2) / 2 + 4;
      const lyy = i === 0 ? (y1 + y2) / 2 : sy(c.Ecell) + 18 + (4 - i) * 22 - 88 + 0; const labY = i === 0 ? ly : Math.min(sy(c.Erev) - 20, sy(c.Ecell) + (4 - i) * 24 + 6);
      if (hh > 0.5 || i === 0) g += F.P('M' + (bx + bw) + ',' + ((y1 + y2) / 2).toFixed(1) + ' L' + (bx + bw + 24) + ',' + ((y1 + y2) / 2).toFixed(1) + ' L' + (bx + bw + 40) + ',' + (labY - 4).toFixed(1) + ' L' + (bx + bw + 48) + ',' + (labY - 4).toFixed(1), { c: G2, w: 0.8 }) + T(bx + bw + 52, labY, sgm[0] + ' = ' + fv(sgm[1], 3) + ' V (' + pct(sgm[1] / c.Ecell) + ') · ' + sgm[3], { s: 10, halo: true });
      acc += sgm[1];
    });
    g += L(vx, sy(c.Etn).toFixed(1), bx + bw + 12, sy(c.Etn).toFixed(1), { c: 'var(--st-heat)', w: 1.4, d: '7 4' }) + T(vx + 4, sy(c.Etn) - 5, 'E_tn ' + fv(c.Etn, 3) + ' V', { s: 9.5, c: 'var(--st-heat)', w: 700, halo: true });
    g += L(bx - 10, sy(c.Ecell).toFixed(1), bx + bw + 10, sy(c.Ecell).toFixed(1), { w: 2 }) + T(bx - 14, sy(c.Ecell) + 4, 'E_cell ' + fv(c.Ecell, 3) + ' V', { a: 'end', s: 11, w: 700 });
    // ---------- polarisation curve ----------
    const px = 800, py = 610, pw = 620, ph = 250; const pol = cs.polar; const jmax = pol[pol.length - 1].j;
    const emin = Math.floor(Math.min(...pol.map(p => p.Erev)) * 10) / 10 - 0.1, emax = Math.ceil(Math.max(...pol.map(p => p.Ecell)) * 10) / 10;
    const X = j => px + j / jmax * pw, Y = e => py + ph - (e - emin) / (emax - emin) * ph;
    g += T(px, py - 16, 'Polarisation curve and operating point', { s: 12.5, w: 700 });
    g += '<rect x="' + px + '" y="' + py + '" width="' + pw + '" height="' + ph + '" fill="none" stroke="var(--dw-ink)" stroke-width="1"/>';
    for (let e = emin; e <= emax + 1e-9; e += 0.2) g += L(px, Y(e).toFixed(1), px + pw, Y(e).toFixed(1), { c: 'var(--dw-grid)', w: 0.7 }) + T(px - 6, Y(e) + 4, e.toFixed(1), { a: 'end', s: 9, c: G2 });
    const jst = jmax > 2 ? 0.5 : jmax > 1 ? 0.25 : 0.1; for (let j = 0; j <= jmax + 1e-9; j += jst) g += L(X(j).toFixed(1), py, X(j).toFixed(1), py + ph, { c: 'var(--dw-grid)', w: 0.7 }) + T(X(j), py + ph + 14, j.toFixed(2).replace(/0$/, ''), { a: 'middle', s: 9, c: G2 });
    g += F.P('M' + pol.map(p => X(p.j).toFixed(1) + ',' + Y(p.Ecell).toFixed(1)).join(' L'), { c: 'var(--st-lye)', w: 2.2 });
    g += F.P('M' + pol.map(p => X(p.j).toFixed(1) + ',' + Y(p.Erev).toFixed(1)).join(' L'), { c: G2, w: 1.2, d: '5 3' });
    const ox = X(cs.j), oy = Y(c.Ecell);
    g += F.Cir(ox, oy, 6, { f: 'var(--st-heat)', c: 'var(--dw-ink)', w: 1.2 }) + T(ox + 10, oy - 8, 'rated: ' + fv(cs.j, 2) + ' A/cm², ' + fv(c.Ecell, 3) + ' V', { s: 10, w: 700 });
    g += T(px + pw / 2, py + ph + 32, 'Current density j (A/cm²)', { a: 'middle', s: 10, c: G2 }) + T(px - 34, py + ph / 2, 'E (V)', { a: 'middle', s: 10, c: G2, rot: -90 });
    // ---------- data table ----------
    const rows = [['Reversible voltage E_rev (T, p)', fv(c.Erev, 3), 'V', 'CM 3.5/3.6'], ['Thermoneutral voltage E_tn', fv(c.Etn, 3), 'V', 'CM 3.3'], ['Cell voltage E_cell', fv(c.Ecell, 3), 'V', 'CM 4.4'], ['Faradaic efficiency η_F', fv(c.etaF, 4), '–', 'CM 7.6'], ['H₂ in O₂ rated / minimum load', fv(100 * c.xH2inO2, 2) + ' / ' + fv(100 * cs.minLoadX, 2), '%', 'CM 7.7'],
      ['Stack SEC', fv(c.SEC_stack, 2), 'kWh/kg', 'CM 7.5'], ['Efficiency η_HHV / η_LHV', fv(c.eff_HHV, 3) + ' / ' + fv(c.eff_LHV, 3), '–', 'CM 3.8'], ['Heat released', fv(c.q_heat_kWhkg, 2), 'kWh/kg', 'CM 3.12'], ['Degradation → stack life', fv(cs.degr.tEoL, 0), 'h', 'CM 6.6']];
    g += T(40, 690, 'CELL DATA', { s: 10.5, w: 700 }) + F.table(40, 698, [{ t: 'Quantity', w: 220 }, { t: 'Value', w: 110, a: 'end' }, { t: 'Unit', w: 70 }, { t: 'Ref.', w: 90 }], rows, { rh: 18, s: 9.5 });
    g += F.note(40, 940, [ 'Kinetic parameters of the ' + cs.techName + ' preset: j₀,a ' + (H2.TECH[tech].j0a).toExponential(1) + ', j₀,c ' + (H2.TECH[tech].j0c).toExponential(1) + ' A/cm², α ' + H2.TECH[tech].alpha + ', ASR ' + H2.TECH[tech].ASR + ' Ω cm² (CM Tables 4.2, 4.3).', 'Operating above E_tn the cell releases heat that the cooling system removes (CM 3.10).'], {});
    return F.wrap(sh, g, { title: 'CEL-001 Cell' });
  };

  /* =================================================================
     STK-001 STACK, MODULE AND PLANT ARRANGEMENT
     ================================================================= */
  F.stackDwg = function (sys) {
    const b = sys.basis, cs = sys.cellStack, tech = cs.tech;
    const sh = F.sheet({ w: 1500, h: 1060, title: 'Stack, module and plant arrangement', dwg: 'STK-001', project: b.name, site: b.siteName || '', doc: b, basis: 'Stack relations CM 6.1; active area CM 5.1; degradation CM 6.6.' });
    const pitch = { PEM: 3.0, AEL: 6.0, AEM: 3.5, SOEC: 2.5 }[tech] || 4; // mm per repeat unit
    const side = Math.sqrt(cs.Acell) * 10; // mm
    const Lst = cs.cells * pitch + 2 * 80; // mm incl. end plates
    let g = T(40, 60, 'EL-101 – ' + cs.techName + ' stack: ' + cs.cells + ' cells × ' + fv(cs.Acell) + ' cm², ' + fv(cs.I, 0) + ' A, ' + fv(cs.V, 0) + ' V, ' + fv(cs.Pst, 0) + ' kW', { s: 15, w: 700 });
    // side view, scaled to fit 700 x 300
    const sc = Math.min(700 / Lst, 280 / (side + 120));
    const sx = 80, sy = 190, sl = Lst * sc, shh = side * sc;
    g += T(sx, sy - 86, 'SIDE VIEW (schematic)', { s: 10.5, w: 700 });
    const ep = 80 * sc;
    g += F.Rct(sx, sy - 10, ep, shh + 20, { f: 'var(--dw-fill2)', w: 1.6 }) + F.Rct(sx + sl - ep, sy - 10, ep, shh + 20, { f: 'var(--dw-fill2)', w: 1.6 });
    g += '<rect x="' + (sx + ep) + '" y="' + sy + '" width="' + (sl - 2 * ep) + '" height="' + shh + '" fill="var(--dw-fill)" stroke="var(--dw-ink)" stroke-width="1.4"/>';
    const nl = Math.min(cs.cells, 120); for (let i = 1; i < nl; i++) { const xx = sx + ep + i * (sl - 2 * ep) / nl; g += L(xx.toFixed(1), sy + 2, xx.toFixed(1), sy + shh - 2, { c: 'var(--dw-thin)', w: 0.6 }); }
    if (cs.cells > 120) g += '<rect x="' + (sx + sl / 2 - 12) + '" y="' + (sy - 4) + '" width="24" height="' + (shh + 8) + '" fill="var(--dw-sheet)"/>' + F.P('M' + (sx + sl / 2 - 12) + ',' + (sy - 4) + ' l6,' + (shh / 2 + 4) + ' l-6,' + (shh / 2 + 4) + ' M' + (sx + sl / 2 + 12) + ',' + (sy - 4) + ' l6,' + (shh / 2 + 4) + ' l-6,' + (shh / 2 + 4), { w: 1 });
    // tie rods
    g += L(sx - 12, sy - 18, sx + sl + 12, sy - 18, { w: 2 }) + L(sx - 12, sy + shh + 18, sx + sl + 12, sy + shh + 18, { w: 2 });
    [sx - 12, sx + sl + 12].forEach(xx => { g += F.Rct(xx - 5, sy - 24, 10, 12, { f: 'var(--dw-ink)', w: 0 }) + F.Rct(xx - 5, sy + shh + 12, 10, 12, { f: 'var(--dw-ink)', w: 0 }); });
    // ports
    g += F.line([[sx + ep / 2, sy - 10], [sx + ep / 2, sy - 58]], 'h2') + T(sx + ep / 2 + 6, sy - 50, 'H₂ ' + (tech === 'SOEC' ? '+ steam' : '+ ' + (tech === 'PEM' ? 'water' : 'electrolyte')) + ' out', { s: 9.5, c: 'var(--st-h2)', w: 700 });
    g += F.line([[sx + sl - ep / 2, sy - 10], [sx + sl - ep / 2, sy - 58]], 'o2') + T(sx + sl - ep / 2 - 6, sy - 50, 'O₂ out', { a: 'end', s: 9.5, c: 'var(--st-o2)', w: 700 });
    g += F.line([[sx + ep / 2, sy + shh + 70], [sx + ep / 2, sy + shh + 10]], tech === 'PEM' || tech === 'SOEC' ? 'water' : 'lye') + T(sx + ep / 2 + 6, sy + shh + 64, tech === 'SOEC' ? 'steam in' : tech === 'PEM' ? 'water in' : 'electrolyte in', { s: 9.5, w: 700 });
    // current terminals
    g += F.line([[sx + 10, sy + shh / 2], [sx - 40, sy + shh / 2]], 'dc', { arrow: false }) + T(sx - 44, sy + shh / 2 + 4, '+', { a: 'end', s: 16, w: 700, c: 'var(--st-dc)' });
    g += F.line([[sx + sl - 10, sy + shh / 2], [sx + sl + 40, sy + shh / 2]], 'dc', { arrow: false }) + T(sx + sl + 44, sy + shh / 2 + 4, '−', { s: 16, w: 700, c: 'var(--st-dc)' });
    // dimension lines
    const dim = (x1, y1, x2, y2, txt, vertical) => { let s2 = L(x1, y1, x2, y2, { c: G2, w: 0.8 }); if (vertical) { s2 += L(x1 - 5, y1, x1 + 5, y1, { c: G2, w: 0.8 }) + L(x1 - 5, y2, x1 + 5, y2, { c: G2, w: 0.8 }) + T(x1 + 8, (y1 + y2) / 2 + 4, txt, { s: 9.5 }); } else { s2 += L(x1, y1 - 5, x1, y1 + 5, { c: G2, w: 0.8 }) + L(x2, y1 - 5, x2, y1 + 5, { c: G2, w: 0.8 }) + T((x1 + x2) / 2, y1 - 5, txt, { a: 'middle', s: 9.5 }); } return s2; };
    g += dim(sx, sy + shh + 100, sx + sl, sy + shh + 100, 'L ≈ ' + fv(Lst / 1000, 2) + ' m (' + cs.cells + ' × ' + pitch + ' mm + end plates)');
    g += dim(sx + sl + 70, sy, sx + sl + 70, sy + shh, '≈ ' + fv(side / 1000, 2) + ' m', true);
    // front view
    const fx = 930, fy = 120, fsz = 220;
    g += T(fx - 16, fy - 28, 'ACTIVE AREA (front view)', { s: 10.5, w: 700 });
    g += '<rect x="' + fx + '" y="' + fy + '" width="' + fsz + '" height="' + fsz + '" fill="url(#xhatch)" stroke="var(--dw-ink)" stroke-width="1.5"/>';
    g += '<rect x="' + (fx - 16) + '" y="' + (fy - 16) + '" width="' + (fsz + 32) + '" height="' + (fsz + 32) + '" fill="none" stroke="var(--dw-ink)" stroke-width="1.2"/>';
    g += dim(fx, fy + fsz + 34, fx + fsz, fy + fsz + 34, fv(side / 10, 1) + ' cm') + T(fx + fsz / 2, fy + fsz / 2 + 4, fv(cs.Acell) + ' cm²', { a: 'middle', s: 13, w: 700 });
    g += T(fx + fsz + 30, fy + 20, 'j = ' + fv(cs.j, 2) + ' A/cm²', { s: 11 }) + T(fx + fsz + 30, fy + 38, 'I = j·A = ' + fv(cs.I, 0) + ' A', { s: 11 }) + T(fx + fsz + 30, fy + 56, 'U = N·E = ' + fv(cs.V, 1) + ' V', { s: 11 }) + T(fx + fsz + 30, fy + 74, 'P = ' + fv(cs.Pst, 0) + ' kW (CM 6.1)', { s: 11 });
    // module
    const mx = 80, my = 560, n = cs.stacksPerMod; const cols = Math.min(n, 6), rowsN = Math.ceil(n / cols);
    g += T(mx, my - 14, 'MODULE: ' + n + ' stack' + (n > 1 ? 's' : '') + ' in parallel on one rectifier (' + b.moduleMW + ' MW)', { s: 10.5, w: 700 });
    g += F.Rct(mx, my, 520, 200, { f: 'var(--dw-sheet)', w: 1.4, d: '6 3' });
    for (let i = 0; i < n; i++) { const cx = mx + 20 + (i % cols) * (300 / cols), cy = my + 22 + Math.floor(i / cols) * (150 / rowsN); g += S.electrolyser(cx, cy, 300 / cols - 14, 150 / rowsN - 16); }
    g += S.converter(mx + 400, my + 60, 40) + T(mx + 400, my + 104, 'RC-101', { a: 'middle', s: 10, w: 700 }) + S.vessel(mx + 460, my + 30, 30, 70, { liq: 'lye' }) + S.vessel(mx + 460, my + 110, 30, 70, { liq: 'lye' }) + T(mx + 475, my + 196, 'V-101/102', { a: 'middle', s: 9 });
    // plant
    const px = 700, py = 560; const nm = b.modules; const pc = Math.min(nm, 10), pr = Math.ceil(nm / pc);
    g += T(px, py - 14, 'PLANT: ' + nm + ' module' + (nm > 1 ? 's' : '') + ' – ' + cs.nStacks + ' stacks, ' + fv(cs.nStacks * cs.cells) + ' cells, ' + fv(cs.Atot_m2, 0) + ' m² active area', { s: 10.5, w: 700 });
    for (let i = 0; i < nm; i++) { const cx = px + (i % pc) * 72, cy = py + Math.floor(i / pc) * 96; g += '<rect x="' + cx + '" y="' + cy + '" width="62" height="82" rx="3" fill="var(--dw-fill)" stroke="var(--dw-ink)" stroke-width="1.2"/>' + T(cx + 31, cy + 46, 'EL-1' + String(i + 1).padStart(2, '0'), { a: 'middle', s: 9, w: 700 }) + T(cx + 31, cy + 60, fvs(b.moduleMW) + ' MW', { a: 'middle', s: 8.5, c: G2 }); }
    // table
    const rows = [['Cells per stack', cs.cells, '–'], ['Cell active area', cs.Acell, 'cm²'], ['Current density (rated)', cs.j, 'A/cm²'], ['Stack current', cs.I, 'A'], ['Stack voltage', cs.V, 'V'], ['Stack power (DC)', cs.Pst, 'kW'], ['H₂ per stack', cs.sysNom.mdot_kgh / cs.nStacks, 'kg/h'],
      ['Stacks per module / plant', cs.stacksPerMod + ' / ' + cs.nStacks, ''], ['Catalyst', tech === 'PEM' ? fv(cs.catalyst_kg, 0) + ' kg Ir (1.5 mg/cm²)' : 'PGM-free', ''], ['Degradation / EoL voltage', fv(cs.degr.EEoL, 3) + ' V after ' + fv(cs.degr.tEoL, 0) + ' h', '']];
    g += T(40, 830 - 12, 'STACK DATA', { s: 10.5, w: 700 });
    g += F.table(40, 826, [{ t: 'Quantity', w: 230 }, { t: 'Value', w: 180, a: 'end' }, { t: 'Unit', w: 60 }], rows.slice(0, 5), { rh: 18, s: 9.5 });
    g += F.table(540, 826, [{ t: 'Quantity', w: 230 }, { t: 'Value', w: 180, a: 'end' }, { t: 'Unit', w: 60 }], rows.slice(5), { rh: 18, s: 9.5 });
    return F.wrap(sh, g, { title: 'STK-001 Stack' });
  };

  /* =================================================================
     WTR-001 WATER-TREATMENT TRAIN
     ================================================================= */
  F.waterDwg = function (sys) {
    const b = sys.basis, w = sys.water; const sea = w.seawater;
    const sh = F.sheet({ w: 1500, h: 1060, title: 'Water-treatment train', dwg: 'WTR-001', project: b.name, site: b.siteName || '', doc: b, basis: 'DM 6.1–6.3 and 8.1–8.10 at rated hydrogen output.' });
    const P1 = w.DI / w.Y2, R2 = P1 - w.DI, F1 = w.raw + R2, Y1eff = P1 / F1;
    const cpermMg = w.perm; // mg/L
    let g = T(40, 60, 'WT-101 – ' + (sea ? 'seawater reverse osmosis, second pass and EDI' : 'reverse osmosis and EDI polishing') + ': ' + fv(w.DI, 2) + ' m³/h demineralised water', { s: 15, w: 700 });
    const y = 250; const blocks = [];
    const blk = (x, label, tag, draw, sub) => { blocks.push({ x, label }); return F.eqg(tag, draw + T(x, y + 72, label, { a: 'middle', s: 11, w: 700 }) + (sub ? T(x, y + 86, sub, { a: 'middle', s: 9.5, c: G2 }) : '')); };
    const xs = [90, 230, 360, 490, 640, 800, 950, 1100, 1260, 1400];
    g += F.line([[40, y], [xs[0] - 34, y]], 'water');
    g += blk(xs[0], sea ? 'Intake & screens' : 'Supply main', 'WT-101', sea ? F.Rct(xs[0] - 34, y - 30, 68, 60, { f: 'var(--dw-fill)' }) + F.P('M' + (xs[0] - 24) + ',' + (y - 20) + ' v40 M' + (xs[0] - 12) + ',' + (y - 20) + ' v40 M' + xs[0] + ',' + (y - 20) + ' v40 M' + (xs[0] + 12) + ',' + (y - 20) + ' v40 M' + (xs[0] + 24) + ',' + (y - 20) + ' v40', { w: 1, c: 'var(--dw-thin)' }) : S.valve(xs[0], y, 12), fv(w.raw, 1) + ' m³/h');
    g += F.line([[xs[0] + 34, y], [xs[1] - 30, y]], 'water');
    g += blk(xs[1], sea ? 'DAF / UF pretreatment' : 'Softener / media filter', 'WT-101', S.vessel(xs[1] - 22, y - 45, 44, 90, { level: false, demister: false }) + '<rect x="' + (xs[1] - 20) + '" y="' + (y - 10) + '" width="40" height="30" fill="url(#dots)"/>', 'SDI < 3');
    g += F.line([[xs[1] + 22, y], [xs[2] - 20, y]], 'water');
    g += blk(xs[2], 'Cartridge filter', 'WT-101', S.filter(xs[2], y, 20), '5 µm');
    g += F.line([[xs[2] + 20, y], [xs[3] - 20, y]], 'water');
    g += blk(xs[3], 'HP pump' + (w.ERD ? ' + ERD' : ''), 'WT-101', S.pump(xs[3], y, 18), fv(w.pf, 1) + ' bar');
    g += F.line([[xs[3] + 22, y], [xs[4] - 50, y]], 'water');
    g += blk(xs[4], 'RO pass 1', 'WT-101', S.membrane(xs[4] - 50, y - 30, 100, 60, 'RO-1'), 'Y = ' + pct(Y1eff));
    g += F.line([[xs[4] + 50, y], [xs[5] - 50, y]], 'water');
    g += blk(xs[5], 'RO pass 2', 'WT-101', S.membrane(xs[5] - 50, y - 30, 100, 60, 'RO-2'), 'Y = ' + pct(w.Y2));
    g += F.line([[xs[5] + 50, y], [xs[6] - 40, y]], 'water');
    g += blk(xs[6], 'EDI polishing', 'WT-101', S.membrane(xs[6] - 40, y - 30, 80, 60, 'EDI'), (w.spec || '≤ 1 µS/cm').replace(/ \(.*/, '').replace(' at the stack', '').replace(' steam-generator feed', ''));
    g += F.line([[xs[6] + 40, y], [xs[7] - 30, y]], 'water');
    g += blk(xs[7], 'TK-101 DI tank', 'TK-101', S.tank(xs[7] - 30, y - 50, 60, 100, 'water'), fv(w.tank, 0) + ' m³');
    g += F.line([[xs[7] + 30, y + 30], [xs[8] - 14, y + 30]], 'water');
    g += blk(xs[8], 'P-101', 'P-101', S.pump(xs[8], y + 30, 14), 'feed pump');
    g += F.line([[xs[8] + 14, y + 16], [xs[9] + 40, y + 16]], 'water') + T(xs[9] + 44, y + 20, 'to EL-101', { s: 10, w: 700 });
    // recycle of pass-2 reject
    g += F.line([[xs[5] + 36, y + 30], [xs[5] + 36, y + 130], [xs[3] + 60, y + 130], [xs[3] + 60, y]], 'water', { dash: '6 3' }) + T(xs[5] - 40, y + 146, 'pass-2 reject recycled ' + fv(R2, 2) + ' m³/h', { a: 'middle', s: 9.5, c: G2 });
    // brine
    g += F.line([[xs[4] + 36, y + 30], [xs[4] + 36, y + 220], [xs[4] + 300, y + 220]], 'water') + F.offpage(xs[4] + 310, y + 220, sea ? 'Outfall' : 'Sewer', 'right', 'water');
    g += T(xs[4] + 46, y + 210, 'brine ' + fv(w.brine, 1) + ' m³/h · ' + fv(w.TDSc, 1) + ' g/L' + (w.diffuser ? ' · diffuser dilution ' + fv(w.diffuser.Sr, 0) + ' (DM 8.8)' : ''), { s: 10, w: 700 });
    // chemical dosing
    [['antiscalant', xs[1] + 60, 150], ['acid (pH control)', xs[2] - 30, 125], [sea ? 'SBS (dechlorination)' : 'dechlorination', xs[2] + 36, 100]].forEach(d => { g += F.line([[d[1], y - d[2]], [d[1], y - 4]], 'ink', { w: 1, dash: '3 2' }) + T(d[1], y - d[2] - 6, d[0], { a: 'middle', s: 9, c: G2 }); });
    // stream values table
    const rows = [['Raw water', w.raw, fv(w.TDS, 2) + ' g/L', '3'], ['RO pass-1 feed (incl. recycle)', F1, fv((w.raw * w.TDS) / F1, 2) + ' g/L', fv(w.pf, 1)], ['RO pass-1 permeate', P1, fv(cpermMg, 0) + ' mg/L', '1.5'], ['Brine / concentrate', w.brine, fv(w.TDSc, 1) + ' g/L', '1.5'], ['Pass-2 reject (recycled)', R2, '—', '1.5'], ['Demineralised water', w.DI, '< 0.1 µS/cm', '2']];
    g += T(40, 560, 'STREAM DATA', { s: 10.5, w: 700 }) + F.table(40, 568, [{ t: 'Stream', w: 230 }, { t: 'm³/h', w: 70, a: 'end', d: 2 }, { t: 'Salinity', w: 110, a: 'end' }, { t: 'p bar', w: 60, a: 'end' }], rows, { rh: 18, s: 9.5 });
    const chem = [['Feed osmotic pressure', fv(sys.design.data.osm.pif, 1) + ' bar', 'DM 8.1'], ['Concentrate osmotic pressure', fv(sys.design.data.osm.pic, 1) + ' bar', 'DM 8.1'], ['HP energy' + (w.ERD ? ' with ERD' : ''), fv(w.SEC_HP, 2) + ' kWh/m³', 'DM 8.4/8.5'], [w.lsiValid === false ? 'LSI of concentrate (indicative)' : 'LSI of concentrate', fv(w.lsi.LSI, 2), 'DM 8.6'], ['Gypsum saturation', w.gyp.valid ? fv(w.gyp.S, 2) : 'n/a (I > 0.5 mol/L)', 'DM 8.7'], ['Levelised cost of water', fv(w.lcow.LCOW, 2) + ' EUR/m³', 'DM 8.10'], ['Water cost per kg H₂', fv(w.lcow.perkg, 3) + ' EUR/kg', 'DM 8.10']];
    if (w.diffuser) chem.push(['Diffuser dilution achieved / required', fv(w.diffuser.Sr, 0) + ' / ' + fv(w.diffuser.Sreq, 0), 'DM 8.8']);
    g += T(560, 560, 'CHEMISTRY AND COST', { s: 10.5, w: 700 }) + F.table(560, 568, [{ t: 'Quantity', w: 240 }, { t: 'Value', w: 150, a: 'end' }, { t: 'Ref.', w: 80 }], chem, { rh: 18, s: 9.5 });
    g += F.note(40, 900, ['Two-pass recovery Y = Y₁Y₂ /(1 − Y₁(1 − Y₂)) with the pass-2 reject recycled to the pass-1 feed (DM 6.2).', 'Concentrate salinity and permeate quality by DM 8.2; pressures by DM 8.3; energy with isobaric ERD by DM 8.5.', 'Condensate from the gas coolers returns to TK-101 and reduces the make-up (PFD stream 10).'], {});
    return F.wrap(sh, g, { title: 'WTR-001 Water treatment' });
  };

  /* =================================================================
     CMP-001 COMPRESSION TRAIN
     ================================================================= */
  F.compDwg = function (sys) {
    const b = sys.basis, ct = sys.compTrain, T1 = ct.T1 != null ? ct.T1 : 40, Tlim = ct.Tlim || 120;
    const sh = F.sheet({ w: 1500, h: 1060, title: 'Hydrogen compression train', dwg: 'CMP-001', project: b.name, site: b.siteName || '', doc: b, basis: 'Multistage intercooled compression, DM 12.1/12.2, CM 10.4/10.5; discharge temperature limit API 618.' });
    const n = ct.N;
    let g = T(40, 60, n ? 'CP-201 – ' + n + '-stage reciprocating compressor, ' + fv(ct.p1, 1) + ' → ' + fvs(ct.p2) + ' bar, ' + fv(ct.m, 0) + ' kg/h, ' + fv(ct.P, 0) + ' kW (' + ct.units + ' + 1 machines)' : 'No compressor – the storage pressure ' + fvs(ct.p2) + ' bar is not above the suction pressure ' + fv(ct.p1, 1) + ' bar', { s: 15, w: 700 });
    const y = 280; let x = 130;
    // up to four stages are drawn; longer trains show the first stage and the last two stages
    const slots = n <= 4 ? ct.stages.map((s2, i) => i) : [0, 'gap', n - 2, n - 1];
    const sp = Math.min(300, 1170 / Math.max(1, slots.length));
    g += F.line([[40, y], [x, y]], 'h2') + T(40, y - 34, 'from D-101', { s: 10, c: G2 }) + T(40, y - 20, fv(ct.p1, 1) + ' bar, ' + fv(T1, 0) + ' °C', { s: 10, w: 700 });
    slots.forEach((i, k) => {
      if (i === 'gap') { g += F.line([[x, y], [x + sp, y]], 'h2', { dash: '6 5' }) + T(x + sp / 2, y - 14, '⋯ stages 2 – ' + (n - 2) + ' ⋯', { a: 'middle', s: 11, w: 700, c: G2 }); x += sp; return; }
      const s2 = ct.stages[i];
      g += F.eqg('CP-201', S.vessel(x, y - 50, 32, 100, { liq: 'water' }) + T(x + 16, y + 70, 'KO drum', { a: 'middle', s: 9, c: G2 }));
      g += F.line([[x + 32, y], [x + 80, y]], 'h2');
      g += F.eqg('CP-201', S.compressor(x + 106, y, 26) + T(x + 106, y - 40, 'Stage ' + s2.i, { a: 'middle', s: 11, w: 700 }) + T(x + 106, y + 46, fv(s2.P, 0) + ' kW', { a: 'middle', s: 10, c: G2 }));
      g += F.line([[x + 132, y], [x + 180, y]], 'h2') + T(x + 156, y - 10, fv(s2.T2, 0) + ' °C', { a: 'middle', s: 9.5, c: 'var(--st-heat)', w: 700 });
      g += F.eqg('CP-201', S.hx(x + 200, y, 18) + T(x + 200, y + 36, i === n - 1 ? 'aftercooler' : 'intercooler', { a: 'middle', s: 9, c: G2 }) + T(x + 200, y + 48, fv(s2.Q, 0) + ' kW', { a: 'middle', s: 9, c: G2 }));
      g += F.line([[x + 192, y - 56], [x + 192, y - 16]], 'cool', { dash: '5 3' }) + F.line([[x + 208, y - 16], [x + 208, y - 56]], 'cool', { dash: '5 3' }) + T(x + 200, y - 62, 'CW', { a: 'middle', s: 8.5, c: 'var(--st-cool)', w: 700 });
      const nx = x + sp, last = k === slots.length - 1; g += F.line([[x + 218, y], [last ? nx + 40 : nx, y]], 'h2') + T((x + 218 + nx) / 2 + 10, y - 10, fv(s2.pout, 1) + ' bar', { a: 'middle', s: 10, w: 700 });
      x = nx;
    });
    if (!n) { g += F.line([[x, y], [x + 200, y]], 'h2'); x += 160; }
    g += F.eqg('ST-201', S.storage(x + 40, y - 38, 110, 76) + T(x + 95, y + 58, 'ST-201', { a: 'middle', s: 11, w: 700 }));
    // temperature profile chart
    const cx = 90, cy = 470, cw = 760, ch = 260; const pts = [];
    ct.stages.forEach((s2, i) => { pts.push([i, T1, s2.pin], [i + 0.5, s2.T2, s2.pout], [i + 1, T1, s2.pout]); });
    const Tmax = Math.max(160, Tlim + 20, ...ct.stages.map(s2 => s2.T2 + 20));
    const X = v => cx + v / Math.max(1, n) * cw, Y = t => cy + ch - t / Tmax * ch;
    g += T(cx, cy - 14, 'Gas temperature along the train (limit ' + Tlim + ' °C, API 618)', { s: 12, w: 700 });
    g += '<rect x="' + cx + '" y="' + cy + '" width="' + cw + '" height="' + ch + '" fill="none" stroke="var(--dw-ink)" stroke-width="1"/>';
    for (let t = 0; t <= Tmax; t += 25) g += L(cx, Y(t).toFixed(1), cx + cw, Y(t).toFixed(1), { c: 'var(--dw-grid)', w: 0.7 }) + T(cx - 6, Y(t) + 4, String(t), { a: 'end', s: 9, c: G2 });
    g += L(cx, Y(Tlim).toFixed(1), cx + cw, Y(Tlim).toFixed(1), { c: 'var(--st-o2)', w: 1.3, d: '7 4' }) + T(cx + cw - 4, Y(Tlim) - 5, Tlim + ' °C', { a: 'end', s: 9.5, c: 'var(--st-o2)', w: 700 });
    if (pts.length) g += F.P('M' + pts.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' L'), { c: 'var(--st-heat)', w: 2.2 });
    const every = n > 12 ? 2 : 1;
    ct.stages.forEach((s2, i) => { if (i % every === 0) g += T(X(i + 0.5), cy + ch + 16, (n > 8 ? '' : 'stage ') + s2.i, { a: 'middle', s: 9.5, c: G2 }); });
    g += T(cx - 36, cy + ch / 2, 'T (°C)', { a: 'middle', s: 10, c: G2, rot: -90 });
    // stage table
    const rows = ct.stages.map(s2 => [s2.i, s2.pin, s2.pout, s2.pout / s2.pin, s2.Z, s2.T2, s2.P, s2.Q]);
    rows.push(['Σ', ct.p1, ct.p2, n ? ct.p2 / ct.p1 : 1, '', '', ct.P, ct.P * 0.9]);
    g += T(900, cy - 14, 'STAGE DATA', { s: 10.5, w: 700 }) + F.table(900, cy - 6, [{ t: 'Stage', w: 44, d: 0 }, { t: 'p_in bar', w: 64, a: 'end', d: 1 }, { t: 'p_out bar', w: 70, a: 'end', d: 1 }, { t: 'ratio', w: 50, a: 'end', d: 2 }, { t: 'Z_m', w: 50, a: 'end', d: 3 }, { t: 'T₂ °C', w: 54, a: 'end', d: 0 }, { t: 'P kW', w: 64, a: 'end', d: 0 }, { t: 'Q kW', w: 64, a: 'end', d: 0 }], rows, { rh: n > 12 ? 15 : 19, s: n > 12 ? 8.5 : 9.5 });
    if (n) g += T(900, cy + (n > 12 ? 15 : 19) * (rows.length + 1) + 20, 'Specific energy ' + fv(ct.SEC, 2) + ' kWh/kg (' + fv(100 * ct.SEC / 33.32, 1) + ' % of LHV); isothermal minimum ' + fv(H2.run('CM-10.1', { p1: ct.p1, p2: ct.p2, T1, Zm: 1.03 }).w, 2) + ' kWh/kg (CM 10.1).', { s: 10 });
    g += F.note(40, 900, ['Stage ratio r ≤ min(r_max of the machine, r at the discharge limit ' + Tlim + ' °C) – API 618 6th ed. allows 120 °C for hydrogen-rich gas or non-lubricated cylinders; equal ratios per stage.', 'T₂ = T₁ + T₁(r^((γ−1)/γ) − 1)/η_s with η_s = 0.75; suction ' + fv(T1, 0) + ' °C after each intercooler (air cooling, design ambient + 10 K, at least 40 °C).', 'Shaft power with per-stage compressibility Z_m (Abel–Noble, CM 2.4), η_mech · η_motor = 0.95 · 0.95; cooling duty ≈ 0.9 P (DM 12.2).'], {});
    return F.wrap(sh, g, { title: 'CMP-001 Compression' });
  };

  /* =================================================================
     LAY-001 PLOT PLAN WITH SAFETY DISTANCES
     ================================================================= */
  const KFILL = { process: 'var(--st-lye)', elec: 'var(--st-elec)', water: 'var(--st-water)', util: 'var(--st-cool)', haz: 'var(--st-o2)', nh3: 'var(--st-nh3)', bldg: 'var(--dw-ink2)' };
  F.plotPlan = function (sys) {
    const b = sys.basis, lay = sys.layout;
    const sh = F.sheet({ w: 1500, h: 1060, title: 'Plot plan with safety distances', dwg: 'LAY-001', project: b.name, site: b.siteName || '', doc: b, basis: 'Areas from DM 1.5 and chapter sizing; consequence distances CM 19.1–19.8.', scale: '' });
    const box = { x: 70, y: 110, w: 1360, h: 700 };
    const margin = Math.max(...lay.circles.map(c => c.r)) * 0.3;
    const W = lay.siteW + 2 * margin, Hh = lay.siteH + 2 * margin;
    const sc = Math.min(box.w / W, box.h / Hh);
    const ox = box.x + (box.w - W * sc) / 2 + margin * sc, oy = box.y + (box.h - Hh * sc) / 2 + margin * sc;
    const X = v => ox + v * sc, Y = v => oy + v * sc;
    const nice = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
    const scaleDen = nice.find(v => v >= 1000 / sc / 3.78 / 1.2) || 2000; // approx 1:n on A3
    let g = T(40, 60, 'Hydrogen island – site ' + fv(lay.siteW, 0) + ' m × ' + fv(lay.siteH, 0) + ' m (' + fv(lay.siteW * lay.siteH / 1e4, 2) + ' ha inside the fence)', { s: 15, w: 700 });
    g += T(40, 78, 'Blocks drawn to scale from the sizing of each system; storage yard placed beyond the LFL distance, the 4.7 kW/m² distance and the NFPA 2 group 1 distance.', { s: 10.5, c: G2 });
    g += '<rect x="' + box.x + '" y="' + box.y + '" width="' + box.w + '" height="' + box.h + '" fill="url(#grass)" stroke="var(--dw-thin)" stroke-width="0.8"/>';
    g += '<defs><clipPath id="clipbox"><rect x="' + box.x + '" y="' + box.y + '" width="' + box.w + '" height="' + box.h + '"/></clipPath></defs><g clip-path="url(#clipbox)">';
    // circles (under blocks)
    const stB = lay.blocks.find(q => q.id === 'ST');
    const zst = c => c.kind === 'lfl' ? { c: 'var(--st-o2)', d: '9 5' } : c.kind === 'rad' ? { c: 'var(--st-heat)', d: '4 3' } : { c: 'var(--st-lye)', d: '2 3' };
    lay.circles.forEach(c => { const st = zst(c);
      if (c.kind === 'blast') g += '<circle cx="' + X(c.cx + lay.road).toFixed(1) + '" cy="' + Y(c.cy + lay.road).toFixed(1) + '" r="' + (c.r * sc).toFixed(1) + '" fill="' + st.c + '" fill-opacity="0.04" stroke="' + st.c + '" stroke-width="1.5" stroke-dasharray="' + st.d + '"/>';
      else { const d = c.value; g += '<rect x="' + X(stB.x + lay.road - d).toFixed(1) + '" y="' + Y(stB.y + lay.road - d).toFixed(1) + '" width="' + ((stB.w + 2 * d) * sc).toFixed(1) + '" height="' + ((stB.h + 2 * d) * sc).toFixed(1) + '" rx="' + (d * sc).toFixed(1) + '" fill="' + st.c + '" fill-opacity="0.05" stroke="' + st.c + '" stroke-width="1.5" stroke-dasharray="' + st.d + '"/>'; } });
    // fence and roads
    g += '<rect x="' + X(0) + '" y="' + Y(0) + '" width="' + (lay.siteW * sc).toFixed(1) + '" height="' + (lay.siteH * sc).toFixed(1) + '" fill="var(--dw-sheet)" fill-opacity="0.75" stroke="var(--dw-ink)" stroke-width="1.6" stroke-dasharray="12 4 2 4"/>';
    lay.blocks.forEach(bl => {
      const x = X(bl.x + lay.road), y = Y(bl.y + lay.road), w = bl.w * sc, h = bl.h * sc;
      g += F.eqg(({ EL: 'EL-101', RC: 'RC-101', GP: 'D-101', WT: 'WT-101', CL: 'CL-401', CP: 'CP-201', ST: 'ST-201', NH: 'NH-301', AS: 'AS-301', TK: 'TK-301', HR: 'HR-301', PL: 'PL-301', TL: 'TL-301', SS: 'TR-101', CR: 'TX-401', BT: 'BT-001' })[bl.id] || bl.id,
        '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + KFILL[bl.kind] + '" fill-opacity="0.18" stroke="var(--dw-ink)" stroke-width="1.3"/>' +
        (w > 110 && h > 26 ? T(x + w / 2, y + h / 2 - 2, bl.name, { a: 'middle', s: Math.min(11, Math.max(8, w / 16)), w: 700 }) + T(x + w / 2, y + h / 2 + 11, fv(bl.w, 0) + ' × ' + fv(bl.h, 0) + ' m', { a: 'middle', s: 8.5, c: G2 }) : T(x + w / 2, y + h / 2 + 3, bl.tag || bl.id, { a: 'middle', s: 8.5, w: 700 })) + '<title>' + F.esc(bl.name + ' – ' + fv(bl.w, 0) + ' × ' + fv(bl.h, 0) + ' m') + '</title>');
    });
    g += '</g>';
    // zone legend
    let lgy = box.y + 18; g += '<rect x="' + (box.x + 10) + '" y="' + (box.y + 6) + '" width="330" height="62" fill="var(--dw-sheet)" stroke="var(--dw-thin)" stroke-width="0.8"/>';
    lay.circles.forEach(c => { const st = zst(c); g += L(box.x + 20, lgy - 4, box.x + 60, lgy - 4, { c: st.c, w: 1.8, d: st.d }) + T(box.x + 68, lgy, (c.kind === 'blast' ? 'radius ' : 'offset ') + fv(c.value, c.value < 20 ? 1 : 0) + ' m – ' + c.label, { s: 9.5, w: 600 }); lgy += 18; });
    // north arrow and scale bar
    const nx = 1400, ny = 150; g += F.P('M' + nx + ',' + (ny - 26) + ' L' + (nx + 10) + ',' + (ny + 10) + ' L' + nx + ',' + ny + ' L' + (nx - 10) + ',' + (ny + 10) + ' Z', { f: 'var(--dw-ink)', w: 1 }) + T(nx, ny - 32, 'N', { a: 'middle', s: 13, w: 700 });
    const barM = [10, 20, 25, 50, 100, 200].find(v => v * sc > 80) || 200; const bx = 90, by = 790;
    for (let i = 0; i < 4; i++) g += '<rect x="' + (bx + i * barM * sc / 2).toFixed(1) + '" y="' + by + '" width="' + (barM * sc / 2).toFixed(1) + '" height="6" fill="' + (i % 2 ? 'var(--dw-sheet)' : 'var(--dw-ink)') + '" stroke="var(--dw-ink)" stroke-width="0.8"/>';
    g += T(bx, by - 5, '0', { a: 'middle', s: 9 }) + T(bx + barM * sc, by - 5, fv(barM, 0) + ' m', { a: 'middle', s: 9 }) + T(bx + 2 * barM * sc, by - 5, fv(2 * barM, 0) + ' m', { a: 'middle', s: 9 });
    // off-site note, distance table
    const radC = lay.radC != null ? lay.radC : lay.rad.r, nf = lay.nfpa;
    const rows = [['3 mm leak release at ' + b.storeP + ' bar', fv(lay.rel.m, 1) + ' g/s', 'CM 19.1'], ['Distance to LFL (4 vol-%)', fv(lay.jet.xLFL, 1) + ' m', 'CM 19.5'], ['Jet-flame length', fv(lay.jet.Lf, 1) + ' m', 'CM 19.5'], ['Distance to 4.7 kW/m² (from the leak)', fv(radC, 1) + ' m', 'CM 19.6'], ['Distance to 10 kPa (TNT, 10 % yield)', fv(lay.blast.Rdp, 0) + ' m', 'CM 19.8']]
      .concat(nf ? [['NFPA 2 distance, group 1 / 2 / 3', nf.g1 + ' / ' + nf.g2 + ' / ' + nf.g3 + ' m', 'NFPA 2']] : []).concat([['Separation applied to the storage yard', fv(lay.sepDist, 1) + ' m', 'DM 18.3']]);
    g += T(40, 836, 'SAFETY DISTANCES', { s: 10.5, w: 700 }) + F.table(40, 842, [{ t: 'Quantity', w: 250 }, { t: 'Value', w: 100, a: 'end' }, { t: 'Ref.', w: 60 }], rows, { rh: 16, s: 9.2 });
    g += F.note(470, 856, ['Off this sheet: ' + (b.pvMWp > 0 ? 'PV-001 ' + fvs(b.pvMWp) + ' MWp (' + fv(lay.offsite.pvHa, 0) + ' ha)' : '') + (lay.offsite.windN ? ', WT-001 ' + lay.offsite.windN + ' turbines' : '') + (b.supply === 'grid-ppa' ? ' – PPA generators remote from the site' : '') + '.', 'Zones around ST-201: LFL of a 3 mm leak and 4.7 kW/m² jet-fire radiation (point source at the flame centre) as offsets from the yard boundary; 10 kPa blast as a radius.', 'Screening values – confirm with the code tables in force (NFPA 2 table 7.3.2.3.1.1(a), EIGA Doc 15) and a QRA (DM 18).', 'Oxygen vent VS-402 and hydrogen vent VS-401 on opposite sides, downwind of air intakes (DM 10.3, 18.4).'].concat(b.batMWh > 0 ? ['Battery BT-001: ≥ 3 m clearance to buildings, lot lines and combustibles, UL 9540A-tested units (NFPA 855).'] : []), {});
    return F.wrap(sh, g, { title: 'LAY-001 Plot plan' });
  };

  /* =================================================================
     Live power-flow view for one hour of the annual simulation
     ================================================================= */
  F.powerFlow = function (sys, h) {
    const Sx = sys.annual.series, b = sys.basis;
    const pv = Sx.pv[h] / 1000, wd = Sx.wind[h] / 1000, gr = Sx.grid[h] / 1000, el = Sx.ely[h] / 1000, bt = Sx.bat[h] / 1000, cu = Sx.curt[h] / 1000, h2 = Sx.h2[h], soc = Sx.soc[h], inv = Sx.inv[h] / 1000;
    const aux = Math.max(0, pv + wd + gr - el - bt - cu);
    const Pmax = Math.max(1, b.modules * b.moduleMW * 1.1, b.pvMWp * 0.8 + b.windMW);
    const wid = v => Math.max(1.2, Math.min(26, 26 * Math.sqrt(Math.abs(v) / Pmax)));
    const W = 980, H = 360; let g = '';
    const arrow = (x1, y1, x2, y2, v, type, lab) => {
      if (Math.abs(v) < 1e-3) return F.line([[x1, y1], [x2, y2]], type, { w: 1, dash: '3 4', arrow: false }) + T((x1 + x2) / 2, y1 - 7, lab + ' 0 MW', { a: 'middle', s: 10, c: G2, halo: true });
      const w = wid(v), dir = x2 >= x1 ? 1 : -1, L = Math.min(18, 7 + w * 0.45), hw = w / 2 + Math.min(7, 3 + w * 0.2), xe = x2 - dir * L;
      const pts = [[x1, y1 - w / 2], [xe, y1 - w / 2], [xe, y1 - hw], [x2, y1], [xe, y1 + hw], [xe, y1 + w / 2], [x1, y1 + w / 2]];
      return '<path d="M' + pts.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' L') + ' Z" fill="' + F.col(type) + '" fill-opacity="0.88" stroke="' + F.col(type) + '" stroke-width="0.8" stroke-linejoin="round"/>' +
        T((x1 + x2) / 2, y1 - hw - 5, lab + ' ' + fv(Math.abs(v), 1) + ' MW', { a: 'middle', s: 10.5, w: 700, halo: true });
    };
    const busX = 330;
    g += '<rect x="' + (busX - 5) + '" y="40" width="10" height="290" fill="var(--st-elec)"/>' + T(busX, 30, 'MV bus', { a: 'middle', s: 10, w: 700 });
    if (b.pvMWp > 0) g += S.pv(40, 40, 90, 44) + arrow(140, 70, busX - 6, 70, pv, 'elec', 'PV');
    if (b.windMW > 0) g += S.wind(85, 120, 70) + arrow(140, 160, busX - 6, 160, wd, 'elec', 'Wind');
    if (b.gridMW > 0 || b.auxBackupMW > 0) g += S.gridTower(85, 225, 60) + arrow(140, 262, busX - 6, 262, gr, 'elec', 'Grid');
    g += arrow(busX + 6, 80, 590, 80, el, 'elec', 'Electrolyser') + S.electrolyser(592, 50, 120, 62) + T(652, 128, fv(el / Math.max(1e-9, b.modules * b.moduleMW) * 100, 0) + ' % load', { a: 'middle', s: 10, c: G2 });
    g += arrow(712, 80, 820, 80, h2 / 1000 * 33.32, 'h2', 'H₂') + T(766, 104, fv(h2, 0) + ' kg/h', { a: 'middle', s: 10.5, w: 700, c: 'var(--st-h2)' }) + S.storage(822, 50, 110, 60) + T(877, 128, 'ST-201 ' + fv(inv, 1) + ' t', { a: 'middle', s: 10, c: G2 });
    if (b.batMW > 0) { g += (bt >= 0 ? arrow(busX + 6, 185, 590, 185, bt, 'elec', 'Charge') : arrow(590, 185, busX + 6, 185, -bt, 'elec', 'Discharge')) + S.battery(592, 165, 86, 42) + '<rect x="690" y="170" width="70" height="10" fill="none" stroke="var(--dw-ink)" stroke-width="1"/><rect x="690" y="170" width="' + (70 * soc).toFixed(1) + '" height="10" fill="var(--st-h2)"/>' + T(725, 196, 'SOC ' + fv(100 * soc, 0) + ' %', { a: 'middle', s: 10, c: G2 }); }
    g += arrow(busX + 6, 250, 590, 250, aux, 'aux', 'Auxiliaries') + arrow(busX + 6, 310, 590, 310, cu, 'loss', 'Curtailed');
    const day = Math.floor(h / 24), hr = h % 24; const d = new Date(2026, 0, 1 + day);
    g += T(W - 20, 250, d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + String(hr).padStart(2, '0') + ':00', { a: 'end', s: 20, w: 700 }) + T(W - 20, 272, 'hour ' + h + ' of 8760', { a: 'end', s: 11, c: G2 });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" font-family="Arial, \'Liberation Sans\', Helvetica, sans-serif" class="pflow"><rect width="' + W + '" height="' + H + '" fill="var(--dw-sheet)"/>' + F.defs() + g + '</svg>';
  };

  /* list of drawings for the explorer */
  F.DRAWINGS = [
    { id: 'PFD-001', title: 'Process flow diagram', fn: 'pfd' }, { id: 'SLD-001', title: 'Electrical single-line diagram', fn: 'sld' },
    { id: 'SNK-001', title: 'Energy balance (Sankey)', fn: 'sankeyE' }, { id: 'SNK-002', title: 'Water & mass balance (Sankey)', fn: 'sankeyM' },
    { id: 'CEL-001', title: 'Cell cross-section & voltage', fn: 'cellDwg' }, { id: 'STK-001', title: 'Stack, module & plant', fn: 'stackDwg' },
    { id: 'WTR-001', title: 'Water-treatment train', fn: 'waterDwg' }, { id: 'CMP-001', title: 'Compression train', fn: 'compDwg' }, { id: 'LAY-001', title: 'Plot plan & safety distances', fn: 'plotPlan' }];
  F.sankeyE = sys => F.sankeyDwg(sys, 'energy');
  F.sankeyM = sys => F.sankeyDwg(sys, 'mass');
})(typeof window !== 'undefined' ? window : globalThis);

;
(function (root) { const H2 = root.H2; H2.VERSION = root.HASIM_ENGINE_VERSION; H2.BUILD = root.HASIM_ENGINE_BUILD;
  if (typeof module !== "undefined" && module.exports) { if (typeof __filename === "string") H2.ENGINE_PATH = __filename; module.exports = H2; }
})(typeof window !== "undefined" ? window : globalThis);