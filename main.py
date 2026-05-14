import os
from crewai import Agent, Task, Crew, Process
from crewai.project import CrewBase, agent, task, crew
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from crewai_tools import SerperDevTool

# Nạp các biến môi trường từ file .env
load_dotenv()

# Cấu hình Chat LLM - Gemini
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-pro",
    verbose=True,
    temperature=0.7,
    api_key=os.getenv("GEMINI_API_KEY")
)

# Khởi tạo công cụ tìm kiếm
search_tool = SerperDevTool()

@CrewBase
class SocialMediaCrew:
    """Crew cho hệ thống AI Social Automation"""
    
    # Files cấu hình YAML
    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'

    @agent
    def trend_hunter(self) -> Agent:
        return Agent(
            config=self.agents_config['trend_hunter'],
            tools=[search_tool],
            llm=llm
        )

    @agent
    def content_planner(self) -> Agent:
        return Agent(
            config=self.agents_config['content_planner'],
            llm=llm
        )

    @task
    def search_trend_task(self) -> Task:
        return Task(
            config=self.tasks_config['search_trend_task']
        )

    @task
    def planning_task(self) -> Task:
        return Task(
            config=self.tasks_config['planning_task']
        )

    @crew
    def crew(self) -> Crew:
        """Khởi tạo Crew với process tuần tự"""
        return Crew(
            agents=self.agents,       # Tự động lấy các method có decorator @agent
            tasks=self.tasks,         # Tự động lấy các method có decorator @task
            process=Process.sequential, 
            verbose=True
        )

if __name__ == "__main__":
    print("🚀 Bắt đầu khởi chạy AI Social Automation System...")
    print("🤖 Đang kích hoạt Agent 1 (Trend Hunter) và Agent 2 (Content Planner)")
    
    # Chạy quy trình
    social_crew = SocialMediaCrew()
    result = social_crew.crew().kickoff()
    
    print("\n================ THÀNH QUẢ =================\n")
    print(result)
