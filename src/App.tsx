// App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CollectNotificationProvider } from "@/contexts/CollectNotificationContext";
import { RequiredTransfersNotificationProvider } from "@/contexts/RequiredTransfersNotificationContext";
import { SignalRWaitingProvider } from "@/contexts/SignalRWaitingContext";
import { SignalRHubProvider } from "@/contexts/SignalRHubContext";
import { ScannerProvider } from "@/contexts/ScannerContext";
import { Provider } from "react-redux";
import store from "./redux/store/store";

import { AppShell } from "@/components/layout/AppShell";

import Dashboard from "./pages/Dashboard";
import WelcomePage from "./pages/WelcomePage";
import OrdersPage from "./pages/OrdersPage";
import ValidationPage from "./pages/ValidationPage";
import CreditMemosDraftsPage from "./pages/CreditMemosDraftsPage";
import CreditMemosHistoryPage from "./pages/CreditMemosHistoryPage";
import HistoryPage from "./pages/HistoryPage";
import GoodsPage from "./pages/GoodsPage";
import EmployeesPage from "./pages/EmployeesPage";
import AdmissionPage from "./pages/AdmissionPage";
import AdmissionHistoryPage from "./pages/AdmissionHistoryPage";
import RequiredTransfersPage from "./pages/RequiredTransfersPage";
import InventoryCountingsPage from "./pages/InventoryCountingsPage";
import {
  CollectPage,
  MoveToRegionPage,
  RelocationPage,
  WarehousePage,
  CellsPage,
  InventoryPage,
  ReportsPage,
} from "./pages/PlaceholderPages";
import MoveToRegionHistoryPage from "./pages/MoveToRegionHistoryPage";
import BonusesPage from "./pages/BonusesPage";
import LabelPrintPage from "./pages/LabelPrintPage";
import LabelPrintPopup from "./pages/LabelPrintPopup";
import BankStatementsPage from "./pages/BankStatementsPage";
import BankStatementDetailPage from "./pages/BankStatementDetailPage";
import AccountantRoute from "./components/layout/AccountantRoute";
import AccountantDashboardPage from "./pages/AccountantDashboardPage";
import LoadedPaymentsPage from "./pages/LoadedPaymentsPage";
import ActSverkaAccountsPage from "./pages/ActSverkaAccountsPage";
import ActSverkaDetailPage from "./pages/ActSverkaDetailPage";
import ConversionsPage from "./pages/ConversionsPage";
import ConversionsUploadedPage from "./pages/ConversionsUploadedPage";
import RecommendationsPage from "./pages/RecommendationsPage";
import PicklistsPage from "./pages/PicklistsPage";
import LocalDataPage from "./pages/LocalDataPage";
import NotFound from "./pages/NotFound";

import PublicRoute from "./components/layout/PublicRoute";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import LoginPage from "./pages/Login";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Provider store={store}>
      <AuthProvider>
        <CollectNotificationProvider>
          <RequiredTransfersNotificationProvider>
            <SignalRWaitingProvider>
              <SignalRHubProvider>
              <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  {/* Label print popup — standalone, no AppShell */}
                  <Route path="/p/label" element={<LabelPrintPopup />} />

                  {/* Public */}
                  <Route
                    path="/login"
                    element={
                      <PublicRoute>
                        <LoginPage />
                      </PublicRoute>
                    }
                  />

                  {/* Protected area — ScannerProvider lives here only, so the
                      standalone /p/label print popup never touches the serial port. */}
                  <Route element={<ProtectedRoute />}>
                    <Route
                      element={
                        <ScannerProvider>
                          <AppShell />
                        </ScannerProvider>
                      }
                    >
                      <Route path="/" element={<WelcomePage />} />
                      <Route path="/admission" element={<AdmissionPage />} />
                      <Route path="/admission/history" element={<AdmissionHistoryPage />} />
                      <Route path="/orders" element={<OrdersPage />} />
                      <Route path="/collect" element={<CollectPage />} />
                      <Route path="/validation" element={<ValidationPage />} />
                      <Route path="/returns" element={<Navigate to="/returns/drafts" replace />} />
                      <Route path="/returns/drafts" element={<CreditMemosDraftsPage />} />
                      <Route path="/returns/history" element={<CreditMemosHistoryPage />} />
                      <Route path="/move-to-region" element={<MoveToRegionPage />} />
                      <Route path="/move-to-region/history" element={<MoveToRegionHistoryPage />} />
                      <Route path="/relocation" element={<RelocationPage />} />
                      <Route path="/required-transfers" element={<RequiredTransfersPage />} />
                      <Route path="/history" element={<HistoryPage />} />
                      <Route path="/warehouse" element={<WarehousePage />} />
                      <Route path="/employees" element={<EmployeesPage />} />
                      <Route path="/cells" element={<CellsPage />} />
                      <Route path="/goods" element={<GoodsPage />} />
                      <Route path="/inventory" element={<InventoryPage />} />
                      <Route path="/inventory-countings" element={<InventoryCountingsPage />} />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/bonuses" element={<BonusesPage />} />
                      <Route path="/label-print" element={<LabelPrintPage />} />
                      <Route path="/picklists" element={<PicklistsPage />} />
                      <Route path="/local-data" element={<LocalDataPage />} />

                      {/* Accountant section — bugalter role only */}
                      <Route element={<AccountantRoute />}>
                        <Route path="/accountant/dashboard" element={<AccountantDashboardPage />} />
                        <Route path="/bank-statements" element={<BankStatementsPage />} />
                        <Route path="/bank-statements/:id" element={<BankStatementDetailPage />} />
                        <Route path="/loaded-payments" element={<LoadedPaymentsPage />} />
                        <Route path="/act-sverka" element={<ActSverkaAccountsPage />} />
                        <Route path="/act-sverka/:id" element={<ActSverkaDetailPage />} />
                        <Route path="/conversions" element={<ConversionsPage />} />
                        <Route path="/conversions/uploaded" element={<ConversionsUploadedPage />} />
                        <Route path="/recommendations" element={<RecommendationsPage />} />
                      </Route>
                    </Route>
                  </Route>

                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
              </TooltipProvider>
              </SignalRHubProvider>
            </SignalRWaitingProvider>
          </RequiredTransfersNotificationProvider>
        </CollectNotificationProvider>
      </AuthProvider>
    </Provider>
  </QueryClientProvider>
);

export default App;
