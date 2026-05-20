import { Fragment, useEffect, useMemo, useState } from "react";

type BucketKey = "speedPost" | "parcels" | "other";
type OfficeCategory = "HO" | "SO" | "BO" | "Others";
type TargetBand = "Nil" | "1-10" | ">10" | "Not BO";
type DivisionGroup = "postal" | "rms" | "adminOther" | "missing";

type BucketValues = Record<BucketKey, number>;

interface Summary {
  name: string;
  regionName: string;
  divisionGroup: DivisionGroup;
  officeCount: number;
  officeCountsByCategory: Record<OfficeCategory, number>;
  activeBOs: number;
  nilBOs: number;
  lowBOs: number;
  aboveTargetBOs: number;
  transactions: number;
  revenue: number;
  bucketTransactions: BucketValues;
  bucketRevenue: BucketValues;
}

interface CircleSummary {
  name: string;
  activeBOs: number;
  nilBOs: number;
  lowBOs: number;
  aboveTargetBOs: number;
  transactions: number;
  revenue: number;
  bucketTransactions: BucketValues;
  bucketRevenue: BucketValues;
  divisionCounts: {
    postal: number;
    rms: number;
    adminOther: number;
  };
}

interface Office {
  officeId: number;
  officeName: string;
  officeTypeCode: string;
  officeTypeDesc: string;
  officeStatus: string;
  regionName: string;
  divisionName: string;
  divisionGroup: DivisionGroup;
  subDivisionName: string;
  hoName: string;
  soName: string;
  boName: string;
  category: OfficeCategory;
  missingHierarchy: boolean;
  transactions: number;
  revenue: number;
  rowCount: number;
  bucketTransactions: BucketValues;
  bucketRevenue: BucketValues;
  speedPostDetails: Array<{
    productName: string;
    transactions: number;
    revenue: number;
  }>;
  targetBand: TargetBand;
  negativeRevenue: boolean;
}

interface DashboardData {
  metadata: {
    sourceFiles: { bookings: string; hierarchy: string };
    generatedAt: string;
    dateStart: string;
    dateEnd: string;
    rowCounts: {
      csvRows: number;
      uniqueBookingOffices: number;
      hierarchyOffices: number;
      generatedOffices: number;
    };
    rules: Record<string, unknown>;
  };
  circle: CircleSummary;
  regions: Summary[];
  divisions: Summary[];
  offices: Office[];
  productTotals: Array<{
    productName: string;
    transactions: number;
    revenue: number;
    bucket: BucketKey;
  }>;
  dataQuality: {
    nilBOs: Array<Pick<Office, "officeId" | "officeName" | "regionName" | "divisionName">>;
    missingHierarchyOffices: Array<Pick<Office, "officeId" | "officeName" | "transactions" | "revenue">>;
    negativeRevenueOffices: Array<Pick<Office, "officeId" | "officeName" | "regionName" | "divisionName" | "revenue">>;
    negativeRevenueRowCount: number;
    negativeRevenueRowExamples: Array<{
      officeId: number;
      officeName: string;
      productName: string;
      transactions: number;
      tax: number;
      totalAmount: number;
      revenue: number;
    }>;
  };
}

const DATA_URL = `${import.meta.env.BASE_URL}data/dashboard-data.json`;

const bucketLabels: Record<BucketKey, string> = {
  speedPost: "Speed Post",
  parcels: "Parcels",
  other: "Other bookings"
};

const categoryOrder: OfficeCategory[] = ["HO", "SO", "BO", "Others"];
const bandRank: Record<TargetBand, number> = {
  Nil: 0,
  "1-10": 1,
  ">10": 2,
  "Not BO": 3
};
const bandClass: Record<TargetBand, string> = {
  Nil: "nil",
  "1-10": "low",
  ">10": "above",
  "Not BO": "notBo"
};

const numberFormatter = new Intl.NumberFormat("en-IN");
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});
const compactFormatter = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1
});

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatCompact(value: number): string {
  return compactFormatter.format(value);
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatPercent(value: number, total: number): string {
  if (!total) {
    return "0%";
  }
  return `${Math.round((value / total) * 100)}%`;
}

function targetRate(summary: Pick<Summary, "aboveTargetBOs" | "activeBOs">): number {
  return summary.activeBOs ? summary.aboveTargetBOs / summary.activeBOs : 0;
}

function targetRateLabel(summary: Pick<Summary, "aboveTargetBOs" | "activeBOs">): string {
  return `${Math.round(targetRate(summary) * 100)}%`;
}

function KpiTile({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "good" | "warn" | "risk";
}) {
  return (
    <div className={`kpi-tile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function BucketBar({
  values,
  total,
  compact = false
}: {
  values: BucketValues;
  total: number;
  compact?: boolean;
}) {
  return (
    <div className={`bucket-bar-wrap ${compact ? "compact" : ""}`}>
      <div className="bucket-bar" aria-label="Product mix">
        {(Object.keys(bucketLabels) as BucketKey[]).map((bucket) => {
          const amount = values[bucket];
          const width = total ? (amount / total) * 100 : 0;
          return (
            <span
              key={bucket}
              className={`bucket-segment ${bucket}`}
              style={{ width: `${width}%` }}
              title={`${bucketLabels[bucket]}: ${formatNumber(amount)}`}
            />
          );
        })}
      </div>
      <div className="bucket-legend">
        {(Object.keys(bucketLabels) as BucketKey[]).map((bucket) => (
          <span key={bucket}>
            <i className={bucket} />
            {bucketLabels[bucket]} {formatPercent(values[bucket], total)}
          </span>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({
  kicker,
  title,
  meta
}: {
  kicker: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="section-header">
      <div>
        <span className="kicker">{kicker}</span>
        <h2>{title}</h2>
      </div>
      {meta && <p>{meta}</p>}
    </div>
  );
}

function RegionCard({ region, rank }: { region: Summary; rank: number }) {
  const focusBOs = region.nilBOs + region.lowBOs;

  return (
    <article className="region-card">
      <div className="card-head">
        <span className="rank">#{rank}</span>
        <div>
          <h3>{region.name}</h3>
          <p>{formatNumber(region.officeCount)} offices</p>
        </div>
      </div>

      <div className="metric-row">
        <span>Above target BOs</span>
        <strong>{formatNumber(region.aboveTargetBOs)}</strong>
      </div>
      <div className="metric-row">
        <span>Attention BOs</span>
        <strong>{formatNumber(focusBOs)}</strong>
      </div>
      <div className="metric-row">
        <span>Transactions</span>
        <strong>{formatCompact(region.transactions)}</strong>
      </div>
      <div className="metric-row">
        <span>Revenue</span>
        <strong>{formatCurrency(region.revenue)}</strong>
      </div>

      <div className="target-meter">
        <span style={{ width: targetRateLabel(region) }} />
      </div>
      <p className="target-copy">
        {targetRateLabel(region)} of active BOs crossed 10 transactions
      </p>
      <BucketBar values={region.bucketTransactions} total={region.transactions} compact />
    </article>
  );
}

function DivisionCard({
  division,
  offices,
  selectedCategory,
  onCategoryChange
}: {
  division: Summary;
  offices: Office[];
  selectedCategory: OfficeCategory;
  onCategoryChange: (category: OfficeCategory) => void;
}) {
  const categoryOffices = offices.filter(
    (office) =>
      office.divisionName === division.name && office.category === selectedCategory
  );
  const transactions = categoryOffices.reduce(
    (total, office) => total + office.transactions,
    0
  );
  const revenue = categoryOffices.reduce((total, office) => total + office.revenue, 0);
  const topOffice = [...categoryOffices].sort(
    (left, right) => right.transactions - left.transactions
  )[0];

  return (
    <article className="division-card">
      <div className="card-head">
        <div>
          <h3>{division.name}</h3>
          <p>
            {division.regionName} · {formatNumber(division.officeCount)} offices
          </p>
        </div>
        <span className={`division-pill ${division.divisionGroup}`}>
          {division.divisionGroup === "rms"
            ? "RMS"
            : division.divisionGroup === "adminOther"
              ? "Admin"
              : "Postal"}
        </span>
      </div>

      <div className="segmented" aria-label={`${division.name} office type`}>
        {categoryOrder.map((category) => (
          <button
            key={category}
            type="button"
            className={category === selectedCategory ? "active" : ""}
            onClick={() => onCategoryChange(category)}
          >
            {category}
            <span>{division.officeCountsByCategory[category]}</span>
          </button>
        ))}
      </div>

      <div className="division-stats">
        <div>
          <span>{selectedCategory} offices</span>
          <strong>{formatNumber(categoryOffices.length)}</strong>
        </div>
        <div>
          <span>Transactions</span>
          <strong>{formatCompact(transactions)}</strong>
        </div>
        <div>
          <span>Revenue</span>
          <strong>{formatCurrency(revenue)}</strong>
        </div>
      </div>

      <div className="division-focus">
        <span>BO target</span>
        <strong>
          {formatNumber(division.aboveTargetBOs)} / {formatNumber(division.activeBOs)}
        </strong>
        <em>{targetRateLabel(division)} above 10</em>
      </div>

      {topOffice ? (
        <p className="top-office">
          Top {selectedCategory}: <strong>{topOffice.officeName}</strong> ·{" "}
          {formatNumber(topOffice.transactions)} transactions
        </p>
      ) : (
        <p className="top-office muted">No offices in this category.</p>
      )}
    </article>
  );
}

function QualityPanel({ quality }: { quality: DashboardData["dataQuality"] }) {
  return (
    <section className="quality-panel" aria-label="Data quality watchlist">
      <div>
        <span className="kicker">Data Quality</span>
        <h2>Watchlist</h2>
      </div>
      <div className="quality-grid">
        <div>
          <span>Nil BOs</span>
          <strong>{formatNumber(quality.nilBOs.length)}</strong>
          <small>{quality.nilBOs.map((office) => office.officeName).join(", ")}</small>
        </div>
        <div>
          <span>Missing hierarchy</span>
          <strong>{formatNumber(quality.missingHierarchyOffices.length)}</strong>
          <small>
            {quality.missingHierarchyOffices
              .map((office) => office.officeName)
              .join(", ")}
          </small>
        </div>
        <div>
          <span>Negative revenue rows</span>
          <strong>{formatNumber(quality.negativeRevenueRowCount)}</strong>
          <small>
            {formatNumber(quality.negativeRevenueOffices.length)} office aggregates below zero
          </small>
        </div>
      </div>
    </section>
  );
}

function SearchSection({
  regions,
  divisions,
  offices
}: {
  regions: string[];
  divisions: string[];
  offices: Office[];
}) {
  const [regionFilter, setRegionFilter] = useState("All");
  const [divisionFilter, setDivisionFilter] = useState("All");
  const [officeQuery, setOfficeQuery] = useState("");
  const [expandedOfficeId, setExpandedOfficeId] = useState<number | null>(null);

  const availableDivisions = useMemo(() => {
    const visible = new Set(
      offices
        .filter(
          (office) =>
            regionFilter === "All" || office.regionName === regionFilter
        )
        .map((office) => office.divisionName)
    );
    return divisions.filter((division) => visible.has(division));
  }, [divisionFilter, divisions, offices, regionFilter]);

  const filteredOffices = useMemo(() => {
    const query = officeQuery.trim().toLowerCase();
    return offices
      .filter((office) => regionFilter === "All" || office.regionName === regionFilter)
      .filter(
        (office) =>
          divisionFilter === "All" || office.divisionName === divisionFilter
      )
      .filter((office) => {
        if (!query) {
          return true;
        }
        return [
          office.officeName,
          office.boName,
          office.soName,
          office.hoName,
          String(office.officeId)
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((left, right) => {
        const bandDelta = bandRank[left.targetBand] - bandRank[right.targetBand];
        if (bandDelta !== 0) {
          return bandDelta;
        }
        const transactionDelta = left.transactions - right.transactions;
        if (transactionDelta !== 0) {
          return transactionDelta;
        }
        return left.officeName.localeCompare(right.officeName);
      });
  }, [divisionFilter, officeQuery, offices, regionFilter]);

  const visibleOffices = filteredOffices.slice(0, 300);

  return (
    <section className="search-section">
      <SectionHeader
        kicker="Search"
        title="Region, Division and Office Selection"
        meta={`${formatNumber(filteredOffices.length)} matching offices`}
      />

      <div className="filters">
        <label>
          <span>Region</span>
          <select
            value={regionFilter}
            onChange={(event) => {
              setRegionFilter(event.target.value);
              setDivisionFilter("All");
              setExpandedOfficeId(null);
            }}
          >
            <option>All</option>
            {regions.map((region) => (
              <option key={region}>{region}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Division</span>
          <select
            value={divisionFilter}
            onChange={(event) => {
              setDivisionFilter(event.target.value);
              setExpandedOfficeId(null);
            }}
          >
            <option>All</option>
            {availableDivisions.map((division) => (
              <option key={division}>{division}</option>
            ))}
          </select>
        </label>
        <label className="office-search">
          <span>Office</span>
          <input
            type="search"
            value={officeQuery}
            onChange={(event) => {
              setOfficeQuery(event.target.value);
              setExpandedOfficeId(null);
            }}
            placeholder="Search office name or ID"
          />
        </label>
      </div>

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Sl.</th>
              <th>Name of the Office / BO</th>
              <th>Speed Post</th>
              <th>Parcels</th>
              <th>Other bookings</th>
            </tr>
          </thead>
          <tbody>
            {visibleOffices.map((office, index) => {
              const isExpanded = expandedOfficeId === office.officeId;
              return (
                <Fragment key={office.officeId}>
                  <tr>
                    <td>{index + 1}</td>
                    <td>
                      <div className="office-cell">
                        <strong>{office.officeName}</strong>
                        <span>
                          {office.category} · {office.regionName} · {office.divisionName}
                        </span>
                        <em className={`band ${bandClass[office.targetBand]}`}>
                          {office.targetBand}
                        </em>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="speed-button"
                        onClick={() =>
                          setExpandedOfficeId(isExpanded ? null : office.officeId)
                        }
                      >
                        <strong>
                          {formatNumber(office.bucketTransactions.speedPost)}
                        </strong>
                        <span>
                          {formatCurrency(office.bucketRevenue.speedPost)}
                        </span>
                      </button>
                    </td>
                    <td>
                      <strong>{formatNumber(office.bucketTransactions.parcels)}</strong>
                      <span>{formatCurrency(office.bucketRevenue.parcels)}</span>
                    </td>
                    <td>
                      <strong>{formatNumber(office.bucketTransactions.other)}</strong>
                      <span>{formatCurrency(office.bucketRevenue.other)}</span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="detail-row">
                      <td colSpan={5}>
                        {office.speedPostDetails.length ? (
                          <div className="speed-detail">
                            {office.speedPostDetails.map((detail) => (
                              <div key={detail.productName}>
                                <span>{detail.productName}</span>
                                <strong>{formatNumber(detail.transactions)}</strong>
                                <em>{formatCurrency(detail.revenue)}</em>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="muted">No Speed Post bookings.</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {filteredOffices.length > visibleOffices.length && (
        <p className="table-note">
          Showing first {formatNumber(visibleOffices.length)} of{" "}
          {formatNumber(filteredOffices.length)} matching offices.
        </p>
      )}
    </section>
  );
}

function Dashboard({ data }: { data: DashboardData }) {
  const [divisionCategory, setDivisionCategory] = useState<
    Record<string, OfficeCategory>
  >({});

  const rankedRegions = useMemo(
    () => [...data.regions].sort((left, right) => targetRate(right) - targetRate(left)),
    []
  );
  const regions = useMemo(
    () => data.regions.map((region) => region.name).sort(),
    []
  );
  const divisions = useMemo(
    () =>
      data.divisions
        .map((division) => division.name)
        .sort((left, right) => left.localeCompare(right)),
    []
  );
  const postalDivisions = data.divisions.filter(
    (division) => division.divisionGroup === "postal"
  );
  const rmsDivisions = data.divisions.filter(
    (division) => division.divisionGroup === "rms"
  );
  const adminDivisions = data.divisions.filter(
    (division) => division.divisionGroup === "adminOther"
  );
  const generatedDate = new Date(data.metadata.generatedAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });

  const renderDivisionGroup = (title: string, divisionsToRender: Summary[]) => (
    <div className="division-group">
      <div className="group-title">
        <h3>{title}</h3>
        <span>{formatNumber(divisionsToRender.length)} divisions</span>
      </div>
      <div className="division-grid">
        {divisionsToRender.map((division) => (
          <DivisionCard
            key={division.name}
            division={division}
            offices={data.offices}
            selectedCategory={divisionCategory[division.name] ?? "BO"}
            onCategoryChange={(category) =>
              setDivisionCategory((current) => ({
                ...current,
                [division.name]: category
              }))
            }
          />
        ))}
      </div>
    </div>
  );

  return (
    <main>
      <header className="hero">
        <div>
          <span className="kicker">AP Circle</span>
          <h1>BO Transactions Dashboard</h1>
          <p>
            Monitoring nil and low-transaction Branch Post Offices for{" "}
            {data.metadata.dateStart} to {data.metadata.dateEnd}.
          </p>
        </div>
        <div className="source-panel">
          <span>Data generated</span>
          <strong>{generatedDate}</strong>
          <small>
            {data.metadata.sourceFiles.bookings} ·{" "}
            {data.metadata.sourceFiles.hierarchy}
          </small>
        </div>
      </header>

      <section className="circle-section">
        <SectionHeader
          kicker="Circle Level"
          title="Executive Summary"
          meta={`${formatNumber(data.metadata.rowCounts.csvRows)} booking rows · ${formatNumber(
            data.metadata.rowCounts.generatedOffices
          )} dashboard offices`}
        />

        <div className="kpi-grid">
          <KpiTile
            label="Active BOs"
            value={formatNumber(data.circle.activeBOs)}
            detail="Target: each BO above 10"
          />
          <KpiTile
            label="Nil BOs"
            value={formatNumber(data.circle.nilBOs)}
            detail="Immediate field follow-up"
            tone="risk"
          />
          <KpiTile
            label="BOs with 1-10"
            value={formatNumber(data.circle.lowBOs)}
            detail="Primary improvement pool"
            tone="warn"
          />
          <KpiTile
            label="BOs above 10"
            value={formatNumber(data.circle.aboveTargetBOs)}
            detail={`${targetRateLabel(data.circle)} target achievement`}
            tone="good"
          />
          <KpiTile
            label="Transactions"
            value={formatNumber(data.circle.transactions)}
            detail="article-count total"
          />
          <KpiTile
            label="Revenue Earned"
            value={formatCurrency(data.circle.revenue)}
            detail="total_amount - tax"
          />
        </div>

        <div className="circle-insights">
          <div className="product-panel">
            <h3>Booking Mix</h3>
            <BucketBar
              values={data.circle.bucketTransactions}
              total={data.circle.transactions}
            />
            <div className="bucket-numbers">
              {(Object.keys(bucketLabels) as BucketKey[]).map((bucket) => (
                <div key={bucket}>
                  <span>{bucketLabels[bucket]}</span>
                  <strong>{formatNumber(data.circle.bucketTransactions[bucket])}</strong>
                  <em>{formatCurrency(data.circle.bucketRevenue[bucket])}</em>
                </div>
              ))}
            </div>
          </div>

          <div className="division-counts">
            <h3>Division Structure</h3>
            <div>
              <span>Postal</span>
              <strong>{data.circle.divisionCounts.postal}</strong>
            </div>
            <div>
              <span>RMS</span>
              <strong>{data.circle.divisionCounts.rms}</strong>
            </div>
            <div>
              <span>Admin / Other</span>
              <strong>{data.circle.divisionCounts.adminOther}</strong>
            </div>
          </div>
        </div>
      </section>

      <QualityPanel quality={data.dataQuality} />

      <section className="region-section">
        <SectionHeader
          kicker="Region Level"
          title="Ranking by BO Target Achievement"
          meta="Ranked by share of active BOs above 10 transactions"
        />
        <div className="region-grid">
          {rankedRegions.map((region, index) => (
            <RegionCard key={region.name} region={region} rank={index + 1} />
          ))}
        </div>
      </section>

      <section className="division-section">
        <SectionHeader
          kicker="Division Level"
          title="Postal, RMS and Admin Monitoring"
          meta="Each division card can switch between HO, SO, BO and Others"
        />
        {renderDivisionGroup("Postal Divisions", postalDivisions)}
        {renderDivisionGroup("RMS Divisions", rmsDivisions)}
        {renderDivisionGroup("Admin / Other", adminDivisions)}
      </section>

      <SearchSection regions={regions} divisions={divisions} offices={data.offices} />
    </main>
  );
}

function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    fetch(DATA_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Dashboard data request failed: ${response.status}`);
        }
        return response.json();
      })
      .then((payload: DashboardData) => {
        if (active) {
          setData(payload);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Dashboard data failed to load.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <main>
        <section className="load-state error">
          <span className="kicker">Data</span>
          <h1>Dashboard data could not be loaded</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main>
        <section className="load-state">
          <span className="kicker">Data</span>
          <h1>Loading AP Circle dashboard</h1>
          <p>Preparing the transaction summary.</p>
        </section>
      </main>
    );
  }

  return <Dashboard data={data} />;
}

export default App;
