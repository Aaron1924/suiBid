import { Suspense } from "react"
import { OwnedItemDetailContent } from "./owned-item-detail-content"

export default function OwnedItemDetailPage() {
  return (
    <Suspense fallback={<OwnedItemDetailSkeleton />}>
      <OwnedItemDetailContent />
    </Suspense>
  )
}

function OwnedItemDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="animate-pulse space-y-8">
        <div className="h-8 w-32 bg-secondary rounded" />
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="aspect-square bg-secondary rounded-lg" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 bg-secondary rounded" />
            <div className="h-4 w-full bg-secondary rounded" />
            <div className="h-4 w-2/3 bg-secondary rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
