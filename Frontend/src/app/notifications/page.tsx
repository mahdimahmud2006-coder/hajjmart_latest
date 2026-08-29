"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/store-context";
import { getNotifications, markNotificationRead, type UserNotification } from "@/lib/api";
import { Button, Card, Badge } from "@/components/ui/storefront-primitives";
import { Bell, CheckCheck, ExternalLink, ArrowLeft } from "lucide-react";

export default function NotificationsPage() {
  const router = useRouter();
  const { token, notify, hydrated, refreshNotificationCount } = useStore();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect if not logged in
  useEffect(() => {
    if (hydrated && !token) {
      router.push("/auth/login");
    }
  }, [hydrated, token, router]);

  useEffect(() => {
    if (token) {
      setLoading(true);
      getNotifications(token)
        .then((list) => setNotifications(list))
        .catch(() => setNotifications([]))
        .finally(() => setLoading(false));
    }
  }, [token]);

  if (!hydrated || !token) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 w-full flex items-center justify-center min-h-[400px]">
        <div className="text-center text-[#5B5650] text-[18px]">
          লোড হচ্ছে...
        </div>
      </div>
    );
  }

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter((notification) => !notification.read).map((notification) => notification.id);
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
    await Promise.allSettled(unreadIds.map((id) => markNotificationRead(id, token)));
    await refreshNotificationCount();
    notify("সব নোটিফিকেশন পঠিত হিসেবে চিহ্নিত করা হয়েছে।", "success");
  };

  const handleMarkOneRead = async (id: string) => {
    setNotifications((prev) => prev.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)));
    await markNotificationRead(id, token);
    await refreshNotificationCount();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#DDD6C7] pb-4 mb-6">
        <div>
          <h1 className="text-[24px] sm:text-[32px] font-bold text-[#1A1A1A] flex flex-wrap items-center gap-2 leading-tight">
            <Bell className="w-7 h-7 text-[#1F5D42]" />
            <span>নোটিফিকেশন সেন্টার</span>
            {unreadCount > 0 && (
              <Badge variant="error" className="ms-1">
                {unreadCount}টি নতুন
              </Badge>
            )}
          </h1>
          <p className="text-[18px] text-[#5B5650] mt-1">
            আপনার অর্ডার আপডেট এবং বিশেষ অফারসমূহ
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkAllRead}
            icon={<CheckCheck className="w-4 h-4" />}
          >
            সব পঠিত চিহ্নিত করুন
          </Button>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-[#FFFDF8] border border-[#DDD6C7] rounded-[10px] p-4 h-20 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Notifications List */}
      {!loading && notifications.length > 0 && (
        <div className="flex flex-col gap-3">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              bordered
              className={`p-4 transition-colors flex items-start justify-between gap-4 ${
                !notif.read ? "bg-[#E4EFE8]/40 border-[#1F5D42]" : "bg-[#FFFDF8] opacity-80"
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {!notif.read && (
                    <span className="w-2.5 h-2.5 bg-[#1F5D42] rounded-full shrink-0 animate-pulse" />
                  )}
                  <h3 className="text-[18px] font-bold text-[#1A1A1A]">{notif.title}</h3>
                </div>
                <p className="text-[16px] text-[#5B5650] leading-relaxed">{notif.body}</p>
                <span className="text-[14px] text-[#8C857B] mt-2 block">{notif.created_at}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {notif.link && (
                  <Link
                    href={notif.link}
                    onClick={() => handleMarkOneRead(notif.id)}
                    className="p-2 text-[#1F5D42] hover:bg-[#E4EFE8] rounded-full transition-colors"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && notifications.length === 0 && (
        <Card bordered className="p-8 text-center bg-[#FFFDF8]">
          <Bell className="w-12 h-12 text-[#DDD6C7] mx-auto mb-2" />
          <h2 className="text-[20px] font-bold text-[#1A1A1A]">কোনো নোটিফিকেশন নেই</h2>
          <p className="text-[16px] text-[#5B5650] mt-1">
            আপনার অ্যাকাউন্টের সকল আপডেট এখানে রিয়েল-টাইমে দেখাবে।
          </p>
          <Link href="/products" className="inline-block mt-4">
            <Button variant="primary" size="md">কেনাকাটা শুরু করুন</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
