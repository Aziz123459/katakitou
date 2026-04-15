from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.auth_jwt import KokozitoTokenView
from accounts.client_api import (
    ClaimClientTokenView,
    ClientCartView,
    ClientOrdersView,
    ClientProfileView,
)
from accounts.dashboard_api import (
    AdminAccountDetailView,
    AdminAnalyticsSeriesView,
    AdminDashboardView,
    AdminInventoryView,
    AnalyticsPingView,
    OrderCreateView,
)
from accounts.shop_api import AdminShopProductDetailView, AdminShopProductView, ShopProductPublicListView
from accounts.views import RegisterView
from api import views

urlpatterns = [
    path('health/', views.health, name='health'),
    path('register/', RegisterView.as_view(), name='register'),
    path('client/claim-token/', ClaimClientTokenView.as_view(), name='client-claim-token'),
    path('client/profile/', ClientProfileView.as_view(), name='client-profile'),
    path('client/orders/', ClientOrdersView.as_view(), name='client-orders'),
    path('client/cart/', ClientCartView.as_view(), name='client-cart'),
    path('auth/login/', KokozitoTokenView.as_view(), name='auth-login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('orders/', OrderCreateView.as_view(), name='orders-create'),
    path('analytics/ping/', AnalyticsPingView.as_view(), name='analytics-ping'),
    path('shop/products/', ShopProductPublicListView.as_view(), name='shop-products'),
    path('admin/dashboard/', AdminDashboardView.as_view(), name='admin-dashboard'),
    path(
        'admin/shop-products/<str:product_id>/',
        AdminShopProductDetailView.as_view(),
        name='admin-shop-product-detail',
    ),
    path('admin/shop-products/', AdminShopProductView.as_view(), name='admin-shop-products'),
    path('admin/accounts/<int:user_id>/', AdminAccountDetailView.as_view(), name='admin-account-detail'),
    path('admin/analytics/series/', AdminAnalyticsSeriesView.as_view(), name='admin-analytics-series'),
    path('admin/inventory/', AdminInventoryView.as_view(), name='admin-inventory'),
]
