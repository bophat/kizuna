from django.db import models
from django.contrib.auth.models import User

class Role(models.Model):
    name = models.CharField(max_length=100, unique=True)
    users = models.ManyToManyField(User, related_name='roles')

    def __str__(self):
        return self.name
