import React from 'react';
import { FileText, ShoppingCart, Smartphone, FileSpreadsheet } from 'lucide-react';

interface SuperDashboardProps {
  isAdmin: boolean;
  userEmail: string;
  onNavigate: (view: any) => void;
}

export default function SuperDashboard({ isAdmin, userEmail, onNavigate }: SuperDashboardProps) {
  return (
    <div className="p-8 w-full">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Super Dashboard</h1>
      <p className="text-slate-500 mb-8">Welcome back, {userEmail}. Here is your system overview.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          onClick={() => onNavigate('dashboard')}
          className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm cursor-pointer hover:border-indigo-300 transition"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Requisitions</p>
              <h3 className="text-xl font-bold">Manage</h3>
            </div>
          </div>
        </div>

        <div 
          onClick={() => onNavigate('purchase_bills')}
          className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm cursor-pointer hover:border-teal-300 transition"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Purchase Bills</p>
              <h3 className="text-xl font-bold">Audit</h3>
            </div>
          </div>
        </div>

        <div 
          onClick={() => onNavigate('sim_management')}
          className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm cursor-pointer hover:border-blue-300 transition"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Sim Management</p>
              <h3 className="text-xl font-bold">Track</h3>
            </div>
          </div>
        </div>

        <div 
          onClick={() => onNavigate('money_receipts')}
          className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm cursor-pointer hover:border-emerald-300 transition"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Money Receipts</p>
              <h3 className="text-xl font-bold">Generate</h3>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <h2 className="text-lg font-bold mb-4">System Alerts & Notifications</h2>
        <p className="text-slate-500">No new critical alerts.</p>
      </div>
    </div>
  );
}
