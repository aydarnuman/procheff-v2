# UI Z-Index & Positioning Fixes - Quick Reference

## Critical Issues to Fix Immediately

### 1. ProductDetailModal Tooltip Z-Index (CRITICAL)

**File:** `src/components/modals/ProductDetailModal.tsx`
**Line:** 187

**Current:**
```tsx
<div className="absolute left-0 top-full mt-2 px-4 py-3 bg-gray-800 text-white text-sm rounded-lg shadow-2xl border border-gray-600 hidden group-hover/market:block z-[9999] w-[280px]">
```

**Fix:**
```tsx
<div className="absolute left-0 top-full mt-2 px-4 py-3 bg-gray-800 text-white text-sm rounded-lg shadow-2xl border border-gray-600 hidden group-hover/market:block z-[51] w-[280px]">
```

**Reason:** Tooltip z-index (9999) far exceeds modal z-index (50), causing tooltips to appear on top of modals unintentionally.

---

### 2. ProposalModal Backdrop Z-Index (HIGH)

**File:** `src/components/ihale/ProposalModal.tsx`
**Lines:** 39, 47

**Current:**
```tsx
{/* Line 39 - Backdrop */}
className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"

{/* Line 47 - Modal content */}
className="fixed inset-0 z-50 flex items-center justify-center p-4"
```

**Fix:**
```tsx
{/* Line 39 - Backdrop */}
className="fixed inset-0 bg-black/60 backdrop-blur-sm z-49"

{/* Line 47 - Modal content */}
className="fixed inset-0 z-50 flex items-center justify-center p-4"
```

**Reason:** Both using same z-index creates ambiguous stacking order. Backdrop should be below modal.

---

### 3. Mobile Sidebar Button Safe Area (HIGH)

**File:** `src/components/nav/Sidebar.tsx`
**Lines:** 165

**Current:**
```tsx
<button
  onClick={() => setMobileOpen(true)}
  className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-lg bg-[rgba(20,20,30,0.9)] backdrop-blur-xl border border-gray-800/40 flex items-center justify-center"
  title="Menüyü aç"
>
```

**Fix Option 1 (Simple):**
```tsx
className="lg:hidden fixed top-6 left-6 sm:top-4 sm:left-4 z-50 w-10 h-10 rounded-lg bg-[rgba(20,20,30,0.9)] backdrop-blur-xl border border-gray-800/40 flex items-center justify-center"
```

**Fix Option 2 (Proper - with safe area):**
```tsx
className="lg:hidden fixed z-50 w-10 h-10 rounded-lg bg-[rgba(20,20,30,0.9)] backdrop-blur-xl border border-gray-800/40 flex items-center justify-center"
style={{
  top: 'max(1rem, env(safe-area-inset-top) + 0.5rem)',
  left: 'max(1rem, env(safe-area-inset-left) + 0.5rem)',
}}
```

**Reason:** Current position (top-4 left-4) may be obscured by mobile notches on newer devices.

---

## Medium Priority Improvements

### 4. DocumentUploadCards Responsive Grid (MEDIUM)

**File:** `src/components/ihale/DocumentUploadCards.tsx`
**Line:** 132

**Current:**
```tsx
<div className="grid grid-cols-4 gap-2 w-full">
```

**Fix:**
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 w-full">
```

**Reason:** Hard-coded 4 columns breaks on smaller screens. Should be responsive.

---

### 5. ProductDetailModal Tooltip Boundary Check (MEDIUM)

**File:** `src/components/modals/ProductDetailModal.tsx`
**Lines:** 186-230

**Current:** No viewport boundary detection

**Recommended Enhancement:**
Add logic to reposition tooltip if it would appear outside the modal or viewport.

```tsx
const [tooltipPosition, setTooltipPosition] = useState('below'); // 'below' | 'above' | 'left' | 'right'

useEffect(() => {
  const tooltipEl = tooltipRef.current;
  if (!tooltipEl) return;
  
  const rect = tooltipEl.getBoundingClientRect();
  if (rect.bottom > window.innerHeight) {
    setTooltipPosition('above');
  }
}, []);
```

---

## Optional Enhancements

### Z-Index System Implementation

Create `lib/constants/zindex.ts`:

```tsx
export const Z_INDEX = {
  HIDDEN: -1,
  DEFAULT: 'auto',
  CONTENT: 1,
  BADGE: 10,
  BUTTON: 10,
  MODAL: 50,
  MODAL_BACKDROP: 49,
  TOOLTIP: 51,
  DROPDOWN: 50,
  POPOVER: 50,
  MOBILE_SIDEBAR: 50,
  MOBILE_SIDEBAR_BACKDROP: 40,
  MOBILE_MENU_BUTTON: 50,
} as const;
```

Then use throughout:
```tsx
import { Z_INDEX } from '@/lib/constants/zindex';

className={`z-[${Z_INDEX.TOOLTIP}]`}
```

---

## Testing Checklist

After applying fixes, test:

- [ ] Tooltip appears correctly on ProductDetailModal hover
- [ ] ProposalModal backdrop is behind content
- [ ] Mobile menu button visible on iOS and Android
- [ ] DocumentUploadCards displays correctly on mobile (1 col), tablet (2 cols), desktop (4 cols)
- [ ] All modals stack correctly when multiple opened
- [ ] No visual overlaps or z-index conflicts
- [ ] Tooltips don't appear off-screen on right edge of table

---

## Summary

| Issue | Severity | File | Line | Fix Type |
|-------|----------|------|------|----------|
| Tooltip z-index | CRITICAL | ProductDetailModal.tsx | 187 | Change z-[9999] to z-[51] |
| Backdrop z-index | HIGH | ProposalModal.tsx | 39 | Change z-50 to z-49 |
| Mobile button safe area | HIGH | Sidebar.tsx | 165 | Add safe-area positioning |
| Grid responsiveness | MEDIUM | DocumentUploadCards.tsx | 132 | Add responsive breakpoints |
| Tooltip boundaries | MEDIUM | ProductDetailModal.tsx | 187 | Add viewport detection |

**Total Estimated Fix Time:** 30-45 minutes
**Risk Level:** Very Low (CSS-only changes)
**Testing Required:** Visual regression testing on all browsers and viewports

