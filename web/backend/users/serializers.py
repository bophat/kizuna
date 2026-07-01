from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Role
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name']

class UserSerializer(serializers.ModelSerializer):
    roles = RoleSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'date_joined', 'roles']

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ['username', 'password', 'email']

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data['email'],
            is_staff=False,
            is_superuser=False,
        )

class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields[self.username_field] = serializers.CharField()
        if 'username' in self.fields:
            self.fields['email'] = self.fields.pop('username')

    def validate(self, attrs):
        # The base class uses self.username_field to get the value from attrs
        # If the frontend sends 'email', we should map it to the expected field
        if 'email' in attrs:
            attrs[self.username_field] = attrs.get('email')
        
        return super().validate(attrs)
