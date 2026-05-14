from rest_framework import serializers
from django.contrib.auth.models import User
from shop.models import Product, Order, OrderItem, Category, UserProfile

class UserSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(source='profile.phone', read_only=True)
    address = serializers.CharField(source='profile.address', read_only=True)
    password = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'password', 'phone', 'address', 'date_joined']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(source='products.count', read_only=True)
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'product_count']

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'price', 'currency', 'category', 'category_name',
            'brand', 'location', 'description', 'image',
            'is_limited', 'is_new', 'is_featured', 'is_cheap',
            'likes', 'sales', 'stock', 'created_at', 'updated_at'
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if instance.image:
            if instance.image.name.startswith('http'):
                ret['image'] = instance.image.name
            else:
                request = self.context.get('request')
                if request:
                    ret['image'] = request.build_absolute_uri(instance.image.url)
                else:
                    ret['image'] = instance.image.url
        else:
            ret['image'] = None
        return ret

class OrderItemSerializer(serializers.ModelSerializer):
    product_details = ProductSerializer(source='product', read_only=True)
    
    class Meta:
        model = OrderItem
        fields = ['id', 'order', 'product', 'product_name', 'quantity', 'price', 'product_details']
        read_only_fields = ['id', 'product_details']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    user_details = UserSerializer(source='user', read_only=True)
    payment_receipt = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = '__all__'

    def get_payment_receipt(self, obj):
        if obj.payment_receipt:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.payment_receipt.url)
            return obj.payment_receipt.url
        return None

class DashboardStatsSerializer(serializers.Serializer):
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_orders = serializers.IntegerField()
    total_products = serializers.IntegerField()
    total_customers = serializers.IntegerField()
    recent_orders = OrderSerializer(many=True)
