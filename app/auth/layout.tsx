import { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link href="/" className="block text-center">
            <h1 className="text-4xl font-bold text-indigo-600 hover:text-indigo-500 transition-colors cursor-pointer">
              IdleOps
            </h1>
          </Link>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Account Access
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Access your IdleOps account to manage your cloud resources
          </p>
        </div>
        {children}
      </div>
    </div>
  );
} 