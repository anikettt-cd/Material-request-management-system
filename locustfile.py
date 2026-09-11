from locust import HttpUser, task, between

class MDMLoadTest(HttpUser):
    # Simulate an employee waiting between 1 to 3 seconds before clicking again
    wait_time = between(1, 3)

    @task
    def ping_backend(self):
        # Pinging the root API URL or login page to check server capacity
        self.client.get("/")