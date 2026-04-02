export interface Cashflow {
    amount: number; // negative = outflow (buy), positive = inflow (current value)
    date: Date;
}

/**
 * Computes XIRR using Newton-Raphson.
 * Returns the annualized rate as a percentage (e.g., 15.3 means 15.3%).
 * Returns NaN if it fails to converge.
 */
export function computeXIRR(cashflows: Cashflow[]): number {
    if (cashflows.length < 2) return NaN;

    // Sort ascending by date
    const sorted = [...cashflows].sort((a, b) => a.date.getTime() - b.date.getTime());
    const t0 = sorted[0].date.getTime();
    const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

    const times = sorted.map(cf => (cf.date.getTime() - t0) / MS_PER_YEAR);
    const amounts = sorted.map(cf => cf.amount);

    function npv(rate: number): number {
        if (rate <= -1) return Infinity;
        return amounts.reduce((sum, amt, i) => sum + amt / Math.pow(1 + rate, times[i]), 0);
    }

    function npvDeriv(rate: number): number {
        return amounts.reduce((sum, amt, i) => {
            if (times[i] === 0) return sum;
            return sum - times[i] * amt / Math.pow(1 + rate, times[i] + 1);
        }, 0);
    }

    // Try multiple starting guesses — range wide enough to catch short-hold / high-return cases
    const guesses = [0.1, 0.5, 2.0, 10.0, 50.0, 200.0, 1000.0, -0.1];

    for (const guess of guesses) {
        let rate = guess;
        let converged = false;

        for (let i = 0; i < 300; i++) {
            const f = npv(rate);
            const df = npvDeriv(rate);
            if (!isFinite(f) || Math.abs(df) < 1e-14) break;
            const delta = f / df;
            rate -= delta;
            if (rate < -0.999) rate = -0.999;
            if (Math.abs(delta) < 1e-9) {
                converged = true;
                break;
            }
        }

        if (converged && isFinite(rate) && rate > -1) {
            return rate * 100;
        }
    }

    return NaN;
}
