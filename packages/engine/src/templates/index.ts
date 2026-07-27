/*
 * Copyright 2026 Prashant Shahi
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { CanvasDocumentState, CanvasElement, PageSize } from "../types";
import agenda from "./agenda.json";
import brandStyleGuide from "./brand-style-guide.json";
import brochure from "./brochure.json";
import businessPlan from "./business-plan.json";
import caseStudy from "./case-study.json";
import certificate from "./certificate.json";
import consultingSow from "./consulting-sow.json";
import contract from "./contract.json";
import coverLetter from "./cover-letter.json";
import employeeHandbook from "./employee-handbook.json";
import expenseReport from "./expense-report.json";
import flyer from "./flyer.json";
import grantProposal from "./grant-proposal.json";
import investorOnePager from "./investor-one-pager.json";
import invoice from "./invoice.json";
import letter from "./letter.json";
import meetingMinutes from "./meeting-minutes.json";
import nda from "./nda.json";
import newsletter from "./newsletter.json";
import onboardingChecklist from "./onboarding-checklist.json";
import pressRelease from "./press-release.json";
import projectCharter from "./project-charter.json";
import proposal from "./proposal.json";
import purchaseOrder from "./purchase-order.json";
import quarterlyReport from "./quarterly-report.json";
import resume from "./resume.json";
import salesProposal from "./sales-proposal.json";
import socialMediaKit from "./social-media-kit.json";
import swotAnalysis from "./swot-analysis.json";
import timesheet from "./timesheet.json";
import travelItinerary from "./travel-itinerary.json";
import whitepaper from "./whitepaper.json";

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

export interface TemplateCategoryGroup {
  category: string;
  label: string;
  templates: TemplateMeta[];
}

interface TemplateData {
  page: { size: string; orientation?: string; bgColor?: string };
  elements?: CanvasElement[];
  pageElements?: Record<string, CanvasElement[]>;
}

interface Template extends TemplateMeta {
  data: TemplateData;
}

/** Preferred display order for known categories; unknown ones sort last A–Z. */
const CATEGORY_ORDER = ["business", "marketing", "creative", "other"];

const templates: Template[] = [
  brochure,
  certificate,
  invoice,
  letter,
  resume,
  agenda,
  flyer,
  proposal,
  businessPlan,
  contract,
  coverLetter,
  employeeHandbook,
  expenseReport,
  meetingMinutes,
  nda,
  newsletter,
  pressRelease,
  purchaseOrder,
  quarterlyReport,
  salesProposal,
  socialMediaKit,
  timesheet,
  travelItinerary,
  swotAnalysis,
  projectCharter,
  caseStudy,
  onboardingChecklist,
  whitepaper,
  grantProposal,
  investorOnePager,
  brandStyleGuide,
  consultingSow,
] as Template[];

function categoryLabel(category: string): string {
  if (!category) return "Other";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function listTemplates(): TemplateMeta[] {
  return templates.map(({ data: _d, ...meta }) => meta);
}

/** All templates grouped by `category` for the picker UI. */
export function templatesByCategory(): TemplateCategoryGroup[] {
  const map = new Map<string, TemplateMeta[]>();
  for (const t of listTemplates()) {
    const category = t.category || "other";
    const list = map.get(category) ?? [];
    list.push(t);
    map.set(category, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return [...map.keys()]
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    })
    .map((category) => ({
      category,
      label: categoryLabel(category),
      templates: map.get(category)!,
    }));
}

export function getTemplate(id: string): Template | undefined {
  return templates.find((t) => t.id === id);
}

export function applyTemplate(
  id: string,
): { name: string; data: TemplateData } | undefined {
  const t = getTemplate(id);
  if (!t) return undefined;
  return { name: t.name, data: t.data };
}

/** Convert a template id into a canvas document state for mobile/web editors. */
export function templateToDocumentState(id: string): {
  title: string;
  state: CanvasDocumentState;
} | null {
  const t = applyTemplate(id);
  if (!t) return null;

  const tplPage = t.data.page ?? {};
  const size = (tplPage.size || "a4") as PageSize;
  const orientation = (tplPage.orientation || "portrait") as
    | "portrait"
    | "landscape";
  const bgColor = tplPage.bgColor || "#ffffff";
  const pageLayout = { size, orientation, bgColor };

  if (t.data.pageElements) {
    const allElements = Object.values(t.data.pageElements).flat();
    const maxElId = allElements.reduce(
      (max, el) => Math.max(max, el.id || 0),
      0,
    );
    return {
      title: t.name,
      state: {
        version: 3,
        pageElements: t.data.pageElements,
        pageLayout,
        nextId: maxElId + 1,
      },
    };
  }

  const elements = (t.data.elements ?? []) as CanvasElement[];
  const maxElId = elements.reduce((max, el) => Math.max(max, el.id || 0), 0);
  return {
    title: t.name,
    state: {
      version: 3,
      pageElements: { "0": elements },
      pageLayout,
      nextId: maxElId + 1,
    },
  };
}
