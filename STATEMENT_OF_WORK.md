# Statement of Work (SOW): Insurance Product Configuration System

## 1. Project Overview
The **Insurance Product Configuration System** is a comprehensive web-based administrative platform designed to streamline the management of insurance products, clauses, underwriting strategies, and industry data. The system enables product managers and actuaries to configure complex insurance products, define recommendation strategies for the "Smart Advisor" (智能保顾) feature, and manage the lifecycle of insurance data.

## 2. Scope of Work

### 2.1 Frontend Application Development
Development of a responsive Single Page Application (SPA) using React 19 and Vite. The application serves as the primary interface for all administrative tasks.

### 2.2 Backend & Server Configuration
Setup of a lightweight Node.js/Express server to host the application and handle basic API requests, deployed on Alibaba Cloud (Aliyun) ECS.

### 2.3 Deployment Automation
Implementation of automated deployment scripts to streamline updates to the production environment.

## 3. Functional Requirements

### 3.1 Authentication & User Management
*   **Login Interface**: Secure login page with username/password authentication.
*   **User Management**: Admin interface to view and manage system users (`UserListPage`).
*   **System Settings**: Configuration of global system parameters (`SystemSettingsPage`).

### 3.2 Product Management (`ProductListPage`, `ProductConfigPage`)
*   **Product Catalog**: View, filter, and search existing insurance products.
*   **Product Configuration Wizard**:
    *   **General Information**: Basic product details (Name, Code, Company).
    *   **Coverage Logic**: Detailed configuration of coverage responsibilities, tailored by product type (Health, Accident, Term Life, Whole Life, Annuity).
    *   **Attributes & Tags**: Management of product tags for marketing and filtering.
    *   **Value-Added Services**: Configuration of additional services attached to policies.
*   **Product Preview**: Real-time preview of how the product appears to end-users (`ProductPreview`).

### 3.3 Clause Management (`ClauseManagementPage`)
*   **Clause Repository**: Centralized database of insurance clauses.
*   **CRUD Operations**: Create, Read, Update, and Delete capabilities for clauses.
*   **Clause Parsing**: Structured view of clause content.

### 3.4 Smart Advisor Strategy (`StrategyManagementPage`)
*   **Decision Tables**: Configuration of logic tables that drive product recommendations.
*   **Strategy Configuration**: Define rules for matching products to user profiles.
*   **Calculation Elements**: Manage basic factors used in strategy logic (`SmartAdvisorConfigPage`).

### 3.5 Insurance Knowledge Base
*   **Insurance Type Management**: Define categories (e.g., Critical Illness, Medical) and their hierarchy.
*   **FAQ Configuration**: Manage Frequently Asked Questions per insurance type, including "Focus" flags and display layout (`InsuranceTypeManagementPage`).
*   **Responsibility Management**: Standardized library of coverage responsibilities (`ResponsibilityManagementPage`).

### 3.6 Industry Data Management (`IndustryDataListPage`)
*   **Data Tables**: Management of actuarial and industry-standard data used for calculations.
*   **Data Editing**: Interface to modify industry benchmarks and constants.

### 3.7 Partner Management (`CompanyManagementPage`)
*   **Company Profiles**: Manage insurance company details, logos, and contact info.

### 3.8 Analytics Dashboard (`DataDashboardPage`)
*   **Visualizations**: Graphical representation of system usage, product statistics, and other key performance indicators (KPIs).

## 4. Technical Requirements

### 4.1 Technology Stack
*   **Frontend Framework**: React 19
*   **Build Tool**: Vite 6.2
*   **Language**: TypeScript 5.8
*   **Styling**: Tailwind CSS
*   **Runtime Environment**: Node.js (v22+)
*   **Server**: Express.js
*   **Process Management**: PM2

### 4.2 Performance & Scalability
*   **Optimization**: Code splitting and lazy loading via Vite.
*   **Memory Management**: PM2 configuration for memory limits (400M max memory restart) to ensure stability on limited-resource servers.

### 4.3 Deployment Infrastructure
*   **Host**: Alibaba Cloud (Aliyun) ECS.
*   **Web Server**: Express serving static assets and API routes.
*   **Automation**: Shell scripts (`deploy.sh`) handling:
    *   Local build and packaging.
    *   Secure file transfer (SCP).
    *   Remote environment checks (Node.js, PM2, Firewalld).
    *   Zero-downtime reloads.

## 5. Deliverables

| Deliverable | Description | Format |
| :--- | :--- | :--- |
| **Source Code** | Complete codebase including frontend, server, and config files. | Git Repository |
| **Deployment Scripts** | `deploy.sh` and `ecosystem.config.cjs` for automated deployment. | Shell/JS Files |
| **Product Requirement Docs** | Detailed PRDs (e.g., FAQ Configuration). | Markdown |
| **Deployed Application** | Live access to the system on Aliyun. | URL (Port 3008) |

## 6. Assumptions & Constraints
*   **Browser Support**: Modern browsers (Chrome, Firefox, Safari, Edge).
*   **Data Persistence**: Currently utilizes static constants and mock data; future phases may require full database integration.
*   **Server Access**: Requires SSH access to the Aliyun instance for deployment.
